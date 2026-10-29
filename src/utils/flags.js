import { db, now } from '../db.js';

export const CATEGORIES = [
  {
    name: 'fakemiddleman',
    id: '1564672356046082078',
    aliases: ['fake mm', 'fakemm', 'fake middleman', 'fakemiddleman', 'middleman', 'mm'],
  },
  {
    name: 'phishing',
    id: '1564673815915790336',
    aliases: ['phishing', 'phish', 'token grab', 'grabber', 'logger', 'fake nitro', 'fake link', 'malware', 'virus'],
  },
  { name: 'doxx', id: '1564673896886698024', aliases: ['doxx', 'dox', 'doxing', 'doxxing', 'leak'] },
  { name: 'raid', id: '1564673162397089942', aliases: ['raid', 'raider', 'nuke', 'nuker'] },
  {
    name: 'hate',
    id: '1564674108174770299',
    aliases: ['hate', 'racism', 'racist', 'slur', 'nazi', 'harassment', 'threat'],
  },
  { name: 'spam', id: '1564672671667724382', aliases: ['spam', 'spammer', 'advert', 'ads', 'self promo'] },
  {
    name: 'scam',
    id: '1564665625186664489',
    aliases: ['scam', 'scammer', 'scamming', 'fraud', 'chargeback'],
  },
];

const normalize = (text) =>
  ` ${text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;

const matches = (text, alias) => {
  const word = normalize(alias);
  return text.includes(word) || (word.length > 5 && text.includes(word.trimEnd()));
};

export function categoryOf(reason) {
  const text = normalize(reason);
  return CATEGORIES.find((c) => c.aliases.some((alias) => matches(text, alias))) ?? null;
}

export const emojiUrl = (category) => `https://cdn.discordapp.com/emojis/${category.id}.png?size=64`;

export const categoryName = (reason) => categoryOf(reason)?.name ?? 'other';

export function flagEmoji(reason) {
  const category = categoryOf(reason);
  return category ? `<:${category.name}:${category.id}> ` : '';
}

const toFlag = (row) => ({ ...row, createdAt: new Date(row.createdAt) });

export const addFlag = (userId, reason) =>
  toFlag(
    db.prepare('INSERT INTO Flag (userId, reason, createdAt) VALUES (?, ?, ?) RETURNING *').get(userId, reason, now()),
  );

export const setAlert = (id, messageId) => db.prepare('UPDATE Flag SET messageId = ? WHERE id = ?').run(messageId, id);

export const getFlags = (userId) =>
  db.prepare('SELECT * FROM Flag WHERE userId = ? ORDER BY id DESC').all(userId).map(toFlag);

export const clearFlags = (userId) => db.prepare('DELETE FROM Flag WHERE userId = ?').run(userId).changes;

export function latestFlags(userIds) {
  const latest = new Map();
  if (!userIds.length) return latest;

  const placeholders = userIds.map(() => '?').join(', ');
  const rows = db
    .prepare(`SELECT userId, reason FROM Flag WHERE userId IN (${placeholders}) ORDER BY id DESC`)
    .all(...userIds);
  for (const row of rows) if (!latest.has(row.userId)) latest.set(row.userId, row.reason);
  return latest;
}
