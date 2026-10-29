import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { antibot } from '../utils/antibot.js';
import { fetchBot, has, ownedGuild } from '../utils/permissions.js';

const NEEDED = [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ViewAuditLog];

export default {
  data: new SlashCommandBuilder()
    .setName('antibot')
    .setDescription('Kick bots added by anyone except the owner')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) =>
      o
        .setName('status')
        .setDescription('On or off')
        .setRequired(true)
        .addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }),
    ),

  async execute(ctx) {
    const guild = await ownedGuild(ctx);
    if (!guild) return ctx.reply('Only the server owner can use anti bot', true);

    const on = ctx.option('status') === 'on';

    if (on) {
      const bot = await fetchBot(ctx.guildId, ctx.botId, guild.roles);
      if (!has(bot.base, ...NEEDED)) {
        return ctx.reply('I need **Kick Members**, **Manage Roles** and **View Audit Log**', true);
      }
    }

    antibot.set(ctx.guildId, on);

    await ctx.reply(on ? 'Anti bot is on\nOnly the server owner can add bots now' : 'Anti bot is off');
  },
};
