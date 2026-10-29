import { PermissionFlagsBits } from '@discordjs/core';
import { api } from '../client.js';
import { db } from '../db.js';
import { embed } from './components.js';
import { stripRoles } from './guard.js';
import { fetchBot } from './permissions.js';

const REASON = 'Anti bot';
const ADD_BOTS = PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild;

export const antibot = {
  enabled: (guildId) => Boolean(db.prepare('SELECT 1 FROM AntiBot WHERE guildId = ?').get(guildId)),

  set(guildId, on) {
    if (on) db.prepare('INSERT OR IGNORE INTO AntiBot (guildId) VALUES (?)').run(guildId);
    else db.prepare('DELETE FROM AntiBot WHERE guildId = ?').run(guildId);
  },
};

async function alertOwner(guild, botId, adderId, stripped) {
  const lines = [
    `Blocked a bot in **${guild.name}**`,
    `> <@${botId}> was added by <@${adderId}> · \`${adderId}\``,
    stripped ? '> Their admin roles were removed' : '> Their roles could not be changed',
  ];

  const dm = await api.users.createDM(guild.owner_id);
  await api.channels.createMessage(dm.id, { embeds: [embed(lines.join('\n'))] });
}

export async function blockBot(guildId, adderId, botId) {
  if (!adderId || !botId || adderId === process.env.CLIENT_ID) return;
  if (!antibot.enabled(guildId)) return;

  const guild = await api.guilds.get(guildId);
  if (adderId === guild.owner_id) return;

  await api.guilds.removeMember(guildId, botId, { reason: REASON }).catch(console.error);

  const bot = await fetchBot(guildId, process.env.CLIENT_ID, guild.roles);
  const stripped = await stripRoles(guild, bot, adderId, ADD_BOTS, REASON);

  await alertOwner(guild, botId, adderId, stripped).catch(() => {});
}
