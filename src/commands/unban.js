import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits, RESTJSONErrorCodes } from '@discordjs/core';
import { api } from '../client.js';
import { fetchBot, has } from '../utils/permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('User or ID to unban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(400)),

  async execute(ctx) {
    const user = ctx.user('user');
    const reason = ctx.option('reason');

    await ctx.defer();

    const bot = await fetchBot(ctx.guildId, ctx.botId);
    if (!has(bot.base, PermissionFlagsBits.BanMembers)) {
      return ctx.edit('I need **Ban Members**');
    }

    try {
      await api.guilds.unbanUser(ctx.guildId, user.id, {
        reason: `${ctx.interaction.member.user.username}: ${reason ?? 'No reason'}`,
      });
    } catch (error) {
      if (error.code === RESTJSONErrorCodes.UnknownBan) return ctx.edit(`<@${user.id}> is not banned`);
      throw error;
    }

    const lines = [`<@${user.id}> has been unbanned`];
    if (reason) lines.push(`Reason: ${reason}`);

    await ctx.edit(lines.join('\n'));
  },
};
