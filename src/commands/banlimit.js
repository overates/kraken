import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { setLimit } from '../utils/bans.js';
import { plural } from '../utils/format.js';
import { fetchBot, has, ownedGuild } from '../utils/permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('banlimit')
    .setDescription('Set daily bans per moderator')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((o) =>
      o
        .setName('limit')
        .setDescription('Bans per day, 0 to turn off')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(1000),
    ),

  async execute(ctx) {
    const limit = ctx.option('limit');
    const guild = await ownedGuild(ctx);
    if (!guild) return ctx.reply('Only the server owner can set the ban limit', true);

    setLimit(ctx.guildId, limit);

    if (!limit) return ctx.reply('Ban limit is off');

    const bot = await fetchBot(ctx.guildId, ctx.botId, guild.roles);
    const lines = [`Ban limit set to ${plural(limit, 'ban')} per day`];
    if (
      !has(bot.base, PermissionFlagsBits.ViewAuditLog, PermissionFlagsBits.BanMembers, PermissionFlagsBits.ManageRoles)
    ) {
      lines.push('I need **View Audit Log**, **Ban Members** and **Manage Roles** to enforce it on manual bans');
    }

    await ctx.reply(lines.join('\n'));
  },
};
