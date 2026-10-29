import { ChannelType, OverwriteType, PermissionFlagsBits } from '@discordjs/core';
import { api } from '../client.js';
import { db } from '../db.js';
import { everyoneIn, fetchBot, has } from './permissions.js';

const LOCKED =
  PermissionFlagsBits.SendMessages |
  PermissionFlagsBits.SendMessagesInThreads |
  PermissionFlagsBits.CreatePublicThreads |
  PermissionFlagsBits.CreatePrivateThreads |
  PermissionFlagsBits.AddReactions;

const withGuild = (channels, guildId) => channels.map((c) => ({ ...c, guild_id: guildId }));

export const LOCKABLE = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum];

export const canManage = (bot, channel) =>
  has(bot.base, LOCKED) && has(bot.in(channel), PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles);

export async function channelChoices(guildId, query, locked) {
  const channels = await api.guilds.getChannels(guildId);
  const lockedIds = lockedChannels(guildId);
  const search = query.toLowerCase();

  const list = channels
    .filter((c) => LOCKABLE.includes(c.type) && lockedIds.has(c.id) === locked && c.name.toLowerCase().includes(search))
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ name: `# ${c.name}`, value: c.id }));

  const all = 'all channels'.includes(search) ? [{ name: 'All channels', value: 'all' }] : [];

  return [...all, ...list].slice(0, 25);
}

export const isLocked = (channelId) => Boolean(db.prepare('SELECT 1 FROM Lock WHERE channelId = ?').get(channelId));

const lockedChannels = (guildId) =>
  new Set(
    db
      .prepare('SELECT channelId FROM Lock WHERE guildId = ?')
      .all(guildId)
      .map((row) => row.channelId),
  );

// Permission bitfields go past 2^53, so these rows are read as BigInt
const findLock = (channelId) => db.prepare('SELECT * FROM Lock WHERE channelId = ?').safeIntegers().get(channelId);

const deleteLock = (channelId) => db.prepare('DELETE FROM Lock WHERE channelId = ?').run(channelId);

function overwrite(channel) {
  const everyone = channel.permission_overwrites?.find((o) => o.id === channel.guild_id);
  return { exists: Boolean(everyone), allow: BigInt(everyone?.allow ?? 0), deny: BigInt(everyone?.deny ?? 0) };
}

async function write(channel, allow, deny, reason) {
  if (allow || deny) {
    await api.channels.editPermissionOverwrite(
      channel.id,
      channel.guild_id,
      { type: OverwriteType.Role, allow: String(allow), deny: String(deny) },
      { reason },
    );
  } else if (overwrite(channel).exists) {
    await api.channels.deletePermissionOverwrite(channel.id, channel.guild_id, { reason });
  }
}

export async function lock(channel, bulk = false) {
  const { allow, deny } = overwrite(channel);

  db.prepare('INSERT INTO Lock (channelId, guildId, allow, deny, bulk) VALUES (?, ?, ?, ?, ?)').run(
    channel.id,
    channel.guild_id,
    allow & LOCKED,
    deny & LOCKED,
    bulk ? 1 : 0,
  );

  try {
    await write(channel, allow & ~LOCKED, (deny & ~LOCKED) | LOCKED, 'Channel locked');
  } catch (error) {
    deleteLock(channel.id);
    throw error;
  }
}

async function restore(channel, record) {
  const { allow, deny } = overwrite(channel);

  await write(channel, (allow & ~LOCKED) | record.allow, (deny & ~LOCKED) | record.deny, 'Channel unlocked');
  deleteLock(channel.id);
}

export async function unlock(channel) {
  await restore(channel, findLock(channel.id));
}

export async function lockAll(guildId, botId) {
  const [channels, roles] = await Promise.all([
    api.guilds.getChannels(guildId).then((c) => withGuild(c, guildId)),
    api.guilds.getRoles(guildId),
  ]);
  const bot = await fetchBot(guildId, botId, roles);
  const locked = lockedChannels(guildId);
  let count = 0;

  for (const channel of channels) {
    if (!LOCKABLE.includes(channel.type) || locked.has(channel.id) || !canManage(bot, channel)) continue;
    if (!has(everyoneIn(roles, channel), PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages)) continue;

    try {
      await lock(channel, true);
      count++;
    } catch (error) {
      console.error(error);
    }
  }

  return count;
}

export async function unlockAll(guildId, botId) {
  const locks = db.prepare('SELECT * FROM Lock WHERE guildId = ? AND bulk = 1').safeIntegers().all(guildId);
  if (!locks.length) return 0;

  const [channels, bot] = await Promise.all([
    api.guilds.getChannels(guildId).then((c) => withGuild(c, guildId)),
    fetchBot(guildId, botId),
  ]);
  const byId = new Map(channels.map((c) => [c.id, c]));
  let count = 0;

  for (const record of locks) {
    const channel = byId.get(record.channelId);

    if (!channel) {
      deleteLock(record.channelId);
      continue;
    }
    if (!canManage(bot, channel)) continue;

    try {
      await restore(channel, record);
      count++;
    } catch (error) {
      console.error(error);
    }
  }

  return count;
}
