import { ButtonStyle, ComponentType, TextInputStyle } from '@discordjs/core';
import { COLOR } from '../context.js';
import { db, now } from '../db.js';
import { avatarUrl, download } from './cdn.js';
import { button, row, textInput } from './components.js';
import { createdAt, timestamp } from './format.js';
import { plainContent } from './render.js';

const LIMIT = 2;

export const BLOCKED = 'You cannot send reports';
export const LIMIT_REACHED = 'You reached the daily report limit';
const HISTORY = 10;

const today = () => new Date().toISOString().slice(0, 10);

export const isBlocked = (userId) => Boolean(db.prepare('SELECT 1 FROM ReportBlock WHERE userId = ?').get(userId));

export function setBlocked(userId, blocked) {
  if (blocked) db.prepare('INSERT OR IGNORE INTO ReportBlock (userId, createdAt) VALUES (?, ?)').run(userId, now());
  else db.prepare('DELETE FROM ReportBlock WHERE userId = ?').run(userId);
}

export function remaining(userId) {
  const row = db.prepare('SELECT day, count FROM ReportCount WHERE userId = ?').get(userId);
  return LIMIT - (row?.day === today() ? row.count : 0);
}

export const reserve = db.transaction((userId) => {
  const day = today();
  const row = db.prepare('SELECT day, count FROM ReportCount WHERE userId = ?').get(userId);
  const count = row?.day === day ? row.count : 0;

  if (count >= LIMIT) return null;

  db.prepare(
    `INSERT INTO ReportCount (userId, day, count) VALUES (?, ?, 1)
     ON CONFLICT (userId) DO UPDATE SET day = excluded.day, count = ?`,
  ).run(userId, day, count + 1);
  return LIMIT - count - 1;
});

export function release(userId) {
  db.prepare('UPDATE ReportCount SET count = count - 1 WHERE userId = ? AND day = ? AND count > 0').run(
    userId,
    today(),
  );
}

export const createReport = (userId, subject, targetId = null) =>
  db
    .prepare('INSERT INTO Report (userId, subject, targetId, createdAt) VALUES (?, ?, ?, ?) RETURNING *')
    .get(userId, subject, targetId, now());

export const deleteReport = (id) => db.prepare('DELETE FROM Report WHERE id = ?').run(id);

export function trimHistory(userId) {
  db.prepare(
    `DELETE FROM Report WHERE userId = ? AND id NOT IN (
       SELECT id FROM Report WHERE userId = ? ORDER BY id DESC LIMIT ?
     )`,
  ).run(userId, userId, HISTORY);
}

export const markReplied = (id) => db.prepare('UPDATE Report SET replied = 1 WHERE id = ?').run(id);

export const setStatus = (id, status) => db.prepare('UPDATE Report SET status = ? WHERE id = ?').run(status, id);

export const history = (userId) =>
  db
    .prepare('SELECT * FROM Report WHERE userId = ? ORDER BY id DESC LIMIT ?')
    .all(userId, HISTORY)
    .map((row) => ({ ...row, replied: Boolean(row.replied), createdAt: new Date(row.createdAt) }));

const MAX_IMAGES = 3;
const MAX_SIZE = 8 * 1024 * 1024;

export const reportModal = {
  custom_id: 'report:submit',
  title: 'Send Report',
  components: [
    textInput({
      id: 'subject',
      label: 'What are you reporting',
      placeholder: 'User, Server, Command or something else',
      min_length: 3,
      max_length: 100,
    }),
    textInput({
      id: 'details',
      label: 'Details',
      style: TextInputStyle.Paragraph,
      placeholder: 'Explain what happened, add user IDs, server IDs or links if you have them',
      min_length: 10,
      max_length: 1500,
    }),
    {
      type: ComponentType.Label,
      label: 'Screenshots',
      description: `Optional, up to ${MAX_IMAGES} images`,
      component: {
        type: ComponentType.FileUpload,
        custom_id: 'images',
        min_values: 0,
        max_values: MAX_IMAGES,
        file_types: ['image'],
        required: false,
      },
    },
  ],
};

export async function downloadImages(attachments) {
  const images = attachments
    .filter((a) => a.content_type?.startsWith('image/') && a.size <= MAX_SIZE)
    .slice(0, MAX_IMAGES);

  const files = await Promise.all(
    images.map(async (a, i) => {
      const data = await download(a.url, { maxBytes: MAX_SIZE });
      if (!data) return null;

      const ext =
        a.filename
          .split('.')
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, '') || 'png';
      return { name: `screenshot-${i + 1}.${ext}`, data, contentType: a.content_type };
    }),
  );

  return files.filter(Boolean);
}

export const messageModal = {
  custom_id: 'report:message',
  title: 'Report Message',
  components: [
    textInput({
      id: 'reason',
      label: 'Reason',
      placeholder: 'Scam, harassment, hate speech, spam',
      min_length: 3,
      max_length: 100,
    }),
    textInput({
      id: 'details',
      label: 'Details',
      description: 'Optional',
      style: TextInputStyle.Paragraph,
      placeholder: 'Anything else the team should know',
      max_length: 1000,
      required: false,
    }),
  ],
};

const PENDING_TTL = 15 * 60 * 1000;
const waiting = new Map();

export const pending = {
  set(userId, message) {
    clearTimeout(waiting.get(userId)?.timer);
    const timer = setTimeout(() => waiting.delete(userId), PENDING_TTL).unref();
    waiting.set(userId, { message, timer });
  },

  take(userId) {
    const entry = waiting.get(userId);
    if (!entry) return null;

    clearTimeout(entry.timer);
    waiting.delete(userId);
    return entry.message;
  },
};

export const replyModal = (userId, reportId) => ({
  custom_id: `report:send:${userId}:${reportId}`,
  title: `Reply to report #${reportId}`,
  components: [
    textInput({
      id: 'message',
      label: 'Message',
      description: 'Sent to the reporter in DMs',
      style: TextInputStyle.Paragraph,
      placeholder: 'Your report has been resolved',
      max_length: 1500,
    }),
  ],
});

export function logButtons(userId, reportId, { resolved = false, blocked = false } = {}) {
  const id = (action) => `report:${action}:${userId}:${reportId}`;

  return [
    row(
      button(id('reply'), 'Reply', ButtonStyle.Primary),
      resolved
        ? button(id('reopen'), 'Reopen', ButtonStyle.Secondary)
        : button(id('resolve'), 'Resolve', ButtonStyle.Success),
      blocked
        ? button(id('unblock'), 'Unblock Reporter', ButtonStyle.Secondary)
        : button(id('block'), 'Block Reporter', ButtonStyle.Danger),
    ),
  ];
}

export function logState(message) {
  const ids = message.components.flatMap((r) => r.components.map((c) => c.custom_id ?? ''));

  return {
    resolved: ids.some((id) => id.startsWith('report:reopen:')),
    blocked: ids.some((id) => id.startsWith('report:unblock:')),
  };
}

const messageLink = (message) =>
  `https://discord.com/channels/${message.guild_id ?? '@me'}/${message.channel_id}/${message.id}`;

const code = (text) => `\`${text.replaceAll('`', "'")}\``;

const block = (text) => `\`\`\`\n${text.replaceAll('```', "'''")}\n\`\`\``;

const MESSAGE_FIELD = 1000;

function messageReport({ id, reporter, subject, details, guild, message }) {
  const { author } = message;
  let content = plainContent(message.content ?? '', message.mentions).trim();
  if (content.length > MESSAGE_FIELD) content = `${content.slice(0, MESSAGE_FIELD)}…`;

  return {
    url: messageLink(message),
    description: [`**Reason**`, subject, ...(details ? ['', '**Details**', details] : [])].join('\n'),
    fields: [
      { name: 'Reported user', value: `<@${author.id}>\n${code(author.id)}`, inline: true },
      { name: 'Reported by', value: `<@${reporter.id}>\n${code(reporter.id)}`, inline: true },
      { name: 'Server', value: guild ? `${guild.name}\n${code(guild.id)}` : 'Direct message', inline: true },
      { name: 'Message', value: content ? block(content) : '*No text, attachments only*' },
    ],
    footer: { text: `Report #${id} · Open` },
  };
}

function generalReport({ id, reporter, subject, details, guild }) {
  return {
    author: { name: `${reporter.username} · ${reporter.id}`, icon_url: avatarUrl(reporter) },
    title: subject,
    url: `https://discord.com/users/${reporter.id}`,
    description: `>>> ${details}`,
    fields: [
      { name: 'Reporter', value: `<@${reporter.id}>`, inline: true },
      { name: 'Account created', value: timestamp(createdAt(reporter.id)), inline: true },
      { name: 'Server', value: guild ? `${guild.name}\n${code(guild.id)}` : 'Direct message', inline: true },
    ],
    footer: { text: `Report #${id} · Open` },
  };
}

export function logEmbeds(report) {
  const main = { color: COLOR, ...(report.message ? messageReport(report) : generalReport(report)) };
  const [first, ...rest] = report.images;

  return [
    { ...main, ...(first && { image: { url: `attachment://${first}` } }), timestamp: new Date().toISOString() },
    ...rest.map((name) => ({ url: main.url, image: { url: `attachment://${name}` } })),
  ];
}

const attachmentRef = (image) => image && { url: `attachment://${new URL(image.url).pathname.split('/').pop()}` };

export const cleanEmbeds = (embeds) =>
  embeds.map(({ color, author, title, url, description, fields, thumbnail, image, footer, timestamp }) => ({
    color,
    thumbnail: thumbnail && { url: thumbnail.url },
    author: author && { name: author.name, icon_url: author.icon_url },
    title,
    url,
    description,
    fields: fields?.map(({ name, value, inline }) => ({ name, value, inline })),
    image: attachmentRef(image),
    footer: footer && { text: footer.text },
    timestamp,
  }));

export function addReply(embed, author, message) {
  const line = `**${author}** · ${message.length > 200 ? `${message.slice(0, 200)}…` : message}`;
  const fields = embed.fields ?? [];
  const existing = fields.find((f) => f.name === 'Replies');
  let value = existing ? `${existing.value}\n${line}` : line;

  while (value.length > 1024) value = value.slice(value.indexOf('\n') + 1);

  return {
    ...embed,
    fields: existing
      ? fields.map((f) => (f === existing ? { ...f, value } : f))
      : [...fields, { name: 'Replies', value }],
  };
}
