import { PermissionFlagsBits } from '@discordjs/core';
import { api } from '../client.js';
import { db } from '../db.js';
import { stripRoles } from './guard.js';

const today = () => new Date().toISOString().slice(0, 10);

export function getLimit(guildId) {
  return db.prepare('SELECT "limit" FROM BanLimit WHERE guildId = ?').get(guildId)?.limit ?? null;
}

export const setLimit = db.transaction((guildId, limit) => {
  if (!limit) {
    db.prepare('DELETE FROM BanLimit WHERE guildId = ?').run(guildId);
    db.prepare('DELETE FROM BanCount WHERE guildId = ?').run(guildId);
    return;
  }

  db.prepare(
    'INSERT INTO BanLimit (guildId, "limit") VALUES (?, ?) ON CONFLICT (guildId) DO UPDATE SET "limit" = excluded."limit"',
  ).run(guildId, limit);
});

// Checking and incrementing in one transaction keeps parallel bans from slipping past the limit
export const reserve = db.transaction((guildId, userId, limit) => {
  const day = today();
  const row = db.prepare('SELECT day, count FROM BanCount WHERE guildId = ? AND userId = ?').get(guildId, userId);
  const count = row?.day === day ? row.count : 0;

  if (count >= limit) return null;

  db.prepare(
    `INSERT INTO BanCount (guildId, userId, day, count) VALUES (?, ?, ?, 1)
     ON CONFLICT (guildId, userId) DO UPDATE SET day = excluded.day, count = ?`,
  ).run(guildId, userId, day, count + 1);
  return count + 1;
});

export function release(guildId, userId) {
  db.prepare('UPDATE BanCount SET count = count - 1 WHERE guildId = ? AND userId = ? AND day = ? AND count > 0').run(
    guildId,
    userId,
    today(),
  );
}

export async function punish(guild, bot, executorId, targetId) {
  const reason = 'Ban limit exceeded';

  await api.guilds.unbanUser(guild.id, targetId, { reason }).catch(console.error);
  await stripRoles(guild, bot, executorId, PermissionFlagsBits.BanMembers | PermissionFlagsBits.Administrator, reason);
}
