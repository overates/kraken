import { ButtonStyle, RESTJSONErrorCodes } from '@discordjs/core';
import { api } from '../client.js';
import { COLOR } from '../context.js';
import { db } from '../db.js';
import { button, embed, row } from './components.js';
import { plural } from './format.js';

const TICK = 15_000;
const REFRESH = 5_000;
const KEEP = 24 * 60 * 60 * 1000;
const ENDED_COLOR = 0x2b2d31;
const UNITS = { s: 1, m: 60, h: 3600, d: 86_400, w: 604_800 };
const JOIN_EMOJI = { id: '1564931195861737552', name: 'emojipack1' };

// Discord trims leading spaces from button labels, a braille blank keeps the gap after the emoji
const LABEL_GAP = '\u2800 ';

export const MAX_ACTIVE = 20;
export const MIN_DURATION = 60;
export const MAX_DURATION = 30 * 86_400;

export function parseDuration(text) {
  const parts = [...text.toLowerCase().matchAll(/(\d+)\s*([smhdw])/g)];
  const rest = text
    .toLowerCase()
    .replace(/(\d+)\s*([smhdw])/g, '')
    .trim();
  if (!parts.length || rest) return null;
  return parts.reduce((total, [, n, unit]) => total + Number(n) * UNITS[unit], 0);
}

const IGNORED_ERRORS = new Set([
  RESTJSONErrorCodes.UnknownMessage,
  RESTJSONErrorCodes.UnknownChannel,
  RESTJSONErrorCodes.MissingAccess,
]);

const time = (date, style) => `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;

const winnerIds = (giveaway) => giveaway.winnerIds.split(',').filter(Boolean);

const mentions = (ids) => ids.map((id) => `<@${id}>`).join(' ');

function giveawayEmbed(giveaway, entries) {
  const lines = [
    ...(giveaway.description ? [giveaway.description, ''] : []),
    giveaway.ended
      ? `> Ended ${time(giveaway.endsAt, 'R')}`
      : `> Ends ${time(giveaway.endsAt, 'R')} · ${time(giveaway.endsAt, 'f')}`,
    `> Hosted by <@${giveaway.hostId}>`,
    `> ${plural(giveaway.winners, 'winner')} · ${entries} ${entries === 1 ? 'entry' : 'entries'}`,
  ];

  if (giveaway.ended) {
    const winners = winnerIds(giveaway);
    lines.push('', `**Winners** ${winners.length ? mentions(winners) : 'No valid entries'}`);
  }

  return { color: giveaway.ended ? ENDED_COLOR : COLOR, title: giveaway.prize, description: lines.join('\n') };
}

export const message = (giveaway, entries) => ({
  embeds: [giveawayEmbed(giveaway, entries)],
  components: [
    row(
      button(`giveaway:join:${giveaway.id}`, `${LABEL_GAP}${entries}`, ButtonStyle.Secondary, {
        emoji: JOIN_EMOJI,
        disabled: giveaway.ended,
      }),
    ),
  ],
  allowed_mentions: { parse: [] },
});

const toGiveaway = (row) => row && { ...row, ended: Boolean(row.ended), endsAt: new Date(row.endsAt) };

const countEntries = (giveawayId) =>
  db.prepare('SELECT COUNT(*) AS count FROM GiveawayEntry WHERE giveawayId = ?').get(giveawayId).count;

export const activeCount = (guildId) =>
  db.prepare('SELECT COUNT(*) AS count FROM Giveaway WHERE guildId = ? AND ended = 0').get(guildId).count;

export const getGiveaway = (id) => toGiveaway(db.prepare('SELECT * FROM Giveaway WHERE id = ?').get(id));

export const findByMessage = (messageId) =>
  toGiveaway(db.prepare('SELECT * FROM Giveaway WHERE messageId = ?').get(messageId));

export async function startGiveaway({ guildId, channelId, hostId, prize, description, winners, seconds }) {
  const endsAt = new Date(Date.now() + seconds * 1000).toISOString();
  const giveaway = toGiveaway(
    db
      .prepare(
        `INSERT INTO Giveaway (guildId, channelId, hostId, prize, description, winners, endsAt)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      )
      .get(guildId, channelId, hostId, prize, description, winners, endsAt),
  );

  try {
    const posted = await api.channels.createMessage(channelId, message(giveaway, 0));
    db.prepare('UPDATE Giveaway SET messageId = ? WHERE id = ?').run(posted.id, giveaway.id);
    return { ...giveaway, messageId: posted.id };
  } catch (error) {
    db.prepare('DELETE FROM Giveaway WHERE id = ?').run(giveaway.id);
    throw error;
  }
}

export function addEntry(giveawayId, userId) {
  const { changes } = db
    .prepare('INSERT OR IGNORE INTO GiveawayEntry (giveawayId, userId) VALUES (?, ?)')
    .run(giveawayId, userId);

  if (changes) scheduleRefresh(giveawayId);
  return changes > 0;
}

const pending = new Map();

function scheduleRefresh(giveawayId) {
  if (pending.has(giveawayId)) return;

  pending.set(
    giveawayId,
    setTimeout(async () => {
      pending.delete(giveawayId);
      const giveaway = getGiveaway(giveawayId);
      if (!giveaway?.messageId || giveaway.ended) return;
      await api.channels
        .editMessage(giveaway.channelId, giveaway.messageId, message(giveaway, countEntries(giveaway.id)))
        .catch(() => {});
    }, REFRESH).unref(),
  );
}

// Entrants who left the server are skipped, so keep drawing small random batches until enough members are found
async function pickWinners(giveaway, count, exclude = []) {
  const picked = [];
  const skip = new Set(exclude);

  while (picked.length < count) {
    const batch = (count - picked.length) * 3 + 5;
    const candidates = db
      .prepare('SELECT userId FROM GiveawayEntry WHERE giveawayId = ? ORDER BY RANDOM() LIMIT ?')
      .all(giveaway.id, batch);
    const fresh = candidates.map((c) => c.userId).filter((id) => !skip.has(id));
    if (!fresh.length) break;

    for (const userId of fresh) {
      skip.add(userId);
      const member = await api.guilds.getMember(giveaway.guildId, userId).catch(() => null);
      if (member) picked.push(userId);
      if (picked.length >= count) break;
    }
  }

  return picked;
}

async function announce(giveaway, winners, reroll = false) {
  const text = winners.length
    ? `${reroll ? 'New winner' : 'Congratulations'} ${mentions(winners)}, you won **${giveaway.prize}**`
    : `No valid entries for **${giveaway.prize}**`;

  await api.channels.createMessage(giveaway.channelId, {
    embeds: [embed(text)],
    allowed_mentions: { users: winners },
    ...(giveaway.messageId && { message_reference: { message_id: giveaway.messageId, fail_if_not_exists: false } }),
  });
}

async function endGiveaway(giveaway) {
  const claimed = db.prepare('UPDATE Giveaway SET ended = 1 WHERE id = ? AND ended = 0').run(giveaway.id);
  if (!claimed.changes) return;

  const winners = await pickWinners(giveaway, giveaway.winners);
  const ended = toGiveaway(
    db
      .prepare('UPDATE Giveaway SET winnerIds = ?, endsAt = ? WHERE id = ? RETURNING *')
      .get(winners.join(','), new Date().toISOString(), giveaway.id),
  );

  try {
    await api.channels.editMessage(giveaway.channelId, giveaway.messageId, message(ended, countEntries(giveaway.id)));
    await announce(ended, winners);
  } catch (error) {
    if (!IGNORED_ERRORS.has(error.code)) console.error(error);
  }
}

export async function reroll(giveawayId) {
  const giveaway = getGiveaway(giveawayId);
  if (!giveaway?.ended) return null;

  const previous = winnerIds(giveaway);
  const winners = await pickWinners(giveaway, 1, previous);
  if (!winners.length) return [];

  const updated = toGiveaway(
    db
      .prepare('UPDATE Giveaway SET winnerIds = ? WHERE id = ? RETURNING *')
      .get([...previous, ...winners].join(','), giveaway.id),
  );

  await announce(updated, winners, true).catch(() => {});
  if (giveaway.messageId) {
    const entries = countEntries(giveaway.id);
    await api.channels.editMessage(giveaway.channelId, giveaway.messageId, message(updated, entries)).catch(() => {});
  }

  return winners;
}

const deleteGiveaways = db.transaction((condition, value) => {
  db.prepare(`DELETE FROM GiveawayEntry WHERE giveawayId IN (SELECT id FROM Giveaway WHERE ${condition})`).run(value);
  db.prepare(`DELETE FROM Giveaway WHERE ${condition}`).run(value);
});

async function tick() {
  const due = db
    .prepare('SELECT * FROM Giveaway WHERE ended = 0 AND endsAt <= ? LIMIT 25')
    .all(new Date().toISOString())
    .map(toGiveaway);
  for (const giveaway of due) await endGiveaway(giveaway).catch(console.error);

  deleteGiveaways('ended = 1 AND endsAt <= ?', new Date(Date.now() - KEEP).toISOString());
}

let timer;

export function startScheduler() {
  if (timer) return;
  timer = setInterval(() => tick().catch(console.error), TICK).unref();
  tick().catch(console.error);
}

export const purgeGiveaways = ({ guildId, channelId }) =>
  guildId ? deleteGiveaways('guildId = ?', guildId) : deleteGiveaways('channelId = ?', channelId);
