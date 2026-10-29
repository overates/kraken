import { RESTJSONErrorCodes } from '@discordjs/core';
import { api } from '../client.js';
import { COLOR } from '../context.js';
import { db } from '../db.js';
import { CATEGORIES, categoryName } from './flags.js';

export const SHIELD_CATEGORIES = [...CATEGORIES.map((c) => c.name), 'other'];

const LABELS = {
  scam: 'Scam',
  fakemiddleman: 'Fake MM',
  phishing: 'Phishing',
  spam: 'Spam',
  raid: 'Raid',
  doxx: 'Doxx',
  hate: 'Hate',
  other: 'Other',
};

export const label = (category) => LABELS[category] ?? category;

const parse = (row) => row && { ...row, categories: new Set(row.categories.split(',').filter(Boolean)) };

export const getShield = (guildId) => parse(db.prepare('SELECT * FROM Shield WHERE guildId = ?').get(guildId));

function flagCategories(userId) {
  const flags = db.prepare('SELECT reason FROM Flag WHERE userId = ?').all(userId);
  return new Set(flags.map((flag) => categoryName(flag.reason)));
}

const match = (shield, categories) => [...categories].find((c) => shield.categories.has(c));

function record(guildId, userId) {
  db.prepare('INSERT OR IGNORE INTO ShieldBan (guildId, userId) VALUES (?, ?)').run(guildId, userId);
}

async function alert(shield, userId, category, action) {
  if (!shield.alertChannel) return;

  await api.channels
    .createMessage(shield.alertChannel, {
      embeds: [
        {
          color: COLOR,
          description: `Kraken Shield ${action} a flagged user\n> <@${userId}> · \`${userId}\` · **${label(category)}**`,
        },
      ],
      allowed_mentions: { parse: [] },
    })
    .catch(() => {});
}

export async function guardJoin(guildId, user) {
  if (user.bot) return false;

  const categories = flagCategories(user.id);
  if (!categories.size) return false;

  const shield = getShield(guildId);
  const category = shield && match(shield, categories);
  if (!category) return false;

  const reason = { reason: `Kraken Shield: ${label(category)}` };

  try {
    if (shield.action === 'kick') await api.guilds.removeMember(guildId, user.id, reason);
    else {
      await api.guilds.banUser(guildId, user.id, {}, reason);
      record(guildId, user.id);
    }
  } catch (error) {
    console.error(error);
    return false;
  }

  await alert(shield, user.id, category, shield.action === 'kick' ? 'kicked' : 'banned');
  return true;
}

export function saveShield(guildId, { categories, action, alertChannel }) {
  if (!categories.length) {
    db.prepare('DELETE FROM Shield WHERE guildId = ?').run(guildId);
    return null;
  }

  const row = db
    .prepare(
      `INSERT INTO Shield (guildId, categories, action, alertChannel) VALUES (?, ?, ?, ?)
       ON CONFLICT (guildId) DO UPDATE SET categories = excluded.categories, action = excluded.action,
       alertChannel = excluded.alertChannel
       RETURNING *`,
    )
    .get(guildId, categories.join(','), action, alertChannel);
  return parse(row);
}

export async function banExisting(guildId, shield) {
  if (shield.action !== 'ban') return 0;

  const flags = db.prepare('SELECT userId, reason FROM Flag').all();
  const targets = [...new Set(flags.filter((f) => shield.categories.has(categoryName(f.reason))).map((f) => f.userId))];
  let banned = 0;

  for (let i = 0; i < targets.length; i += 200) {
    const result = await api.guilds
      .bulkBanUsers(
        guildId,
        { user_ids: targets.slice(i, i + 200), delete_message_seconds: 0 },
        { reason: 'Kraken Shield' },
      )
      .catch(() => null);
    for (const userId of result?.banned_users ?? []) record(guildId, userId);
    banned += result?.banned_users?.length ?? 0;
  }

  return banned;
}

// Bans by ID work even if the user never joined, which is what keeps them out of every protected server
export async function propagate(userId, reason) {
  const category = categoryName(reason);
  const shields = db.prepare("SELECT * FROM Shield WHERE action = 'ban'").all();
  let banned = 0;

  for (const row of shields) {
    const shield = parse(row);
    if (!shield.categories.has(category)) continue;

    try {
      await api.guilds.banUser(row.guildId, userId, {}, { reason: `Kraken Shield: ${label(category)}` });
      record(row.guildId, userId);
      await alert(shield, userId, category, 'banned');
      banned++;
    } catch (error) {
      if (
        ![
          RESTJSONErrorCodes.MissingPermissions,
          RESTJSONErrorCodes.UnknownGuild,
          RESTJSONErrorCodes.MissingAccess,
        ].includes(error.code)
      ) {
        console.error(error);
      }
    }
  }

  return banned;
}

export async function revoke(userId) {
  const bans = db.prepare('SELECT guildId FROM ShieldBan WHERE userId = ?').all(userId);

  for (const { guildId } of bans) {
    await api.guilds.unbanUser(guildId, userId, { reason: 'Kraken Shield: flag removed' }).catch(() => {});
  }

  db.prepare('DELETE FROM ShieldBan WHERE userId = ?').run(userId);
  return bans.length;
}

export const purgeShield = db.transaction((guildId) => {
  db.prepare('DELETE FROM Shield WHERE guildId = ?').run(guildId);
  db.prepare('DELETE FROM ShieldBan WHERE guildId = ?').run(guildId);
});
