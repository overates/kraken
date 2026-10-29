import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { api } from '../client.js';
import { getLimit, release, reserve } from '../utils/bans.js';
import { fetchBot, has, highest } from '../utils/permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((o) => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setMaxLength(400)),

  async execute(ctx) {
    const user = ctx.user('user');
    const member = ctx.member('user');
    const reason = ctx.option('reason');

    await ctx.defer();

    const guild = await api.guilds.get(ctx.guildId);
    const bot = await fetchBot(ctx.guildId, ctx.botId, guild.roles);
    const isOwner = ctx.userId === guild.owner_id;

    if (!has(bot.base, PermissionFlagsBits.BanMembers)) {
      return ctx.edit('I need **Ban Members**');
    }
    if (user.id === ctx.userId) {
      return ctx.edit('You cannot ban yourself');
    }
    if (user.id === guild.owner_id || user.id === ctx.botId) {
      return ctx.edit(`<@${user.id}> cannot be banned`);
    }

    if (member) {
      const target = highest(guild.roles, member.roles);

      if (!isOwner && target >= highest(guild.roles, ctx.interaction.member.roles)) {
        return ctx.edit(`<@${user.id}> has a higher or equal role than you`);
      }
      if (target >= bot.highest) {
        return ctx.edit(`<@${user.id}> has a higher or equal role than me`);
      }
    }

    const limit = isOwner ? null : getLimit(ctx.guildId);
    const count = limit && reserve(ctx.guildId, ctx.userId, limit);

    if (limit && !count) {
      return ctx.edit(`Daily ban limit reached · ${limit}/${limit}`);
    }

    try {
      await api.guilds.banUser(
        ctx.guildId,
        user.id,
        {},
        {
          reason: `${ctx.interaction.member.user.username}: ${reason ?? 'No reason'}`,
        },
      );
    } catch (error) {
      if (limit) release(ctx.guildId, ctx.userId);
      throw error;
    }

    const lines = [`<@${user.id}> has been banned`];
    if (reason) lines.push(`Reason: ${reason}`);
    if (limit) lines.push(`${count}/${limit} bans today`);

    await ctx.edit(lines.join('\n'));
  },
};
