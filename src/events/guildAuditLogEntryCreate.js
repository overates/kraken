import { AuditLogEvent, GatewayDispatchEvents } from '@discordjs/core';
import { api } from '../client.js';
import { blockBot } from '../utils/antibot.js';
import { getLimit, punish, reserve } from '../utils/bans.js';
import { fetchBot } from '../utils/permissions.js';

async function banLimit({ guild_id: guildId, user_id: executorId, target_id: targetId }) {
  if (!executorId || executorId === process.env.CLIENT_ID) return;

  const limit = getLimit(guildId);
  if (!limit) return;

  const guild = await api.guilds.get(guildId);
  if (executorId === guild.owner_id) return;

  if (reserve(guildId, executorId, limit)) return;

  await punish(guild, await fetchBot(guildId, process.env.CLIENT_ID, guild.roles), executorId, targetId);
}

export default {
  name: GatewayDispatchEvents.GuildAuditLogEntryCreate,
  execute({ data }) {
    switch (data.action_type) {
      case AuditLogEvent.MemberBanAdd:
        return banLimit(data);
      case AuditLogEvent.BotAdd:
        return blockBot(data.guild_id, data.user_id, data.target_id);
    }
  },
};
