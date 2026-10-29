import { PermissionFlagsBits } from '@discordjs/core';
import { api } from '../client.js';
import { db, now } from '../db.js';

const ROLE = -1;

export const DANGEROUS = [
  'Administrator',
  'ManageGuild',
  'ManageRoles',
  'ManageChannels',
  'ManageWebhooks',
  'BanMembers',
  'KickMembers',
  'ModerateMembers',
  'ManageMessages',
  'ManageThreads',
  'ManageNicknames',
  'MentionEveryone',
  'ManageGuildExpressions',
  'ManageEvents',
].reduce((bits, name) => bits | PermissionFlagsBits[name], 0n);

export const isFrozen = (guildId) => Boolean(db.prepare('SELECT 1 FROM Freeze WHERE guildId = ?').get(guildId));

const saveFrozen = db.transaction((guildId, targets) => {
  db.prepare('INSERT INTO Freeze (guildId, createdAt) VALUES (?, ?)').run(guildId, now());
  const insert = db.prepare(
    'INSERT INTO FrozenPermission (guildId, channelId, targetId, type, removed) VALUES (?, ?, ?, ?, ?)',
  );
  for (const { channelId, targetId, type, removed } of targets) insert.run(guildId, channelId, targetId, type, removed);
});

// Removed bits go past 2^53, so they are read as BigInt
const frozenPermissions = (guildId) =>
  db
    .prepare('SELECT * FROM FrozenPermission WHERE guildId = ?')
    .safeIntegers()
    .all(guildId)
    .map((row) => ({ ...row, type: Number(row.type) }));

const clearFrozen = db.transaction((guildId) => {
  db.prepare('DELETE FROM FrozenPermission WHERE guildId = ?').run(guildId);
  db.prepare('DELETE FROM Freeze WHERE guildId = ?').run(guildId);
});

export async function freeze(guild, channels, bot) {
  const own = new Set(bot.roles);
  const roles = guild.roles.filter((r) => !own.has(r.id) && BigInt(r.permissions) & DANGEROUS);

  const above = roles.filter((r) => r.position >= bot.highest).map((r) => r.id);
  const targets = roles
    .filter((r) => r.position < bot.highest)
    .map((r) => ({ channelId: '', targetId: r.id, type: ROLE, removed: BigInt(r.permissions) & DANGEROUS, role: r }));

  for (const channel of channels) {
    for (const o of channel.permission_overwrites ?? []) {
      const removed = BigInt(o.allow) & DANGEROUS;
      if (removed) targets.push({ channelId: channel.id, targetId: o.id, type: o.type, removed, overwrite: o });
    }
  }

  saveFrozen(guild.id, targets);

  const reason = { reason: 'Server frozen' };
  let roleCount = 0;
  let channelCount = 0;

  for (const target of targets) {
    try {
      if (target.type === ROLE) {
        await api.guilds.editRole(
          guild.id,
          target.targetId,
          { permissions: String(BigInt(target.role.permissions) & ~DANGEROUS) },
          reason,
        );
        roleCount++;
      } else {
        const { allow, deny, type } = target.overwrite;
        await api.channels.editPermissionOverwrite(
          target.channelId,
          target.targetId,
          { type, allow: String(BigInt(allow) & ~DANGEROUS), deny },
          reason,
        );
        channelCount++;
      }
    } catch (error) {
      console.error(error);
      db.prepare('DELETE FROM FrozenPermission WHERE guildId = ? AND channelId = ? AND targetId = ?').run(
        guild.id,
        target.channelId,
        target.targetId,
      );
    }
  }

  return { roleCount, channelCount, above };
}

export async function unfreeze(guildId) {
  const [records, roles, channels] = await Promise.all([
    frozenPermissions(guildId),
    api.guilds.getRoles(guildId),
    api.guilds.getChannels(guildId),
  ]);
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const channelById = new Map(channels.map((c) => [c.id, c]));
  const reason = { reason: 'Server unfrozen' };
  let roleCount = 0;
  let channelCount = 0;

  for (const record of records) {
    try {
      if (record.type === ROLE) {
        const role = roleById.get(record.targetId);
        if (!role) continue;

        await api.guilds.editRole(
          guildId,
          role.id,
          { permissions: String(BigInt(role.permissions) | record.removed) },
          reason,
        );
        roleCount++;
      } else {
        const channel = channelById.get(record.channelId);
        if (!channel) continue;

        const o = channel.permission_overwrites?.find((x) => x.id === record.targetId);
        await api.channels.editPermissionOverwrite(
          channel.id,
          record.targetId,
          {
            type: record.type,
            allow: String(BigInt(o?.allow ?? 0) | record.removed),
            deny: String(BigInt(o?.deny ?? 0) & ~record.removed),
          },
          reason,
        );
        channelCount++;
      }
    } catch (error) {
      console.error(error);
    }
  }

  clearFrozen(guildId);

  return { roleCount, channelCount };
}
