import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { disable, enable } from '../utils/blocklink.js';
import { fetchBot, has } from '../utils/permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('blocklink')
    .setDescription('Block all links and fancy fonts with AutoMod')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((o) =>
      o
        .setName('status')
        .setDescription('On or off')
        .setRequired(true)
        .addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }),
    ),

  async execute(ctx) {
    await ctx.defer();

    const bot = await fetchBot(ctx.guildId, ctx.botId);
    if (!has(bot.base, PermissionFlagsBits.ManageGuild)) return ctx.edit('I need **Manage Server**');

    if (ctx.option('status') === 'off') {
      return ctx.edit((await disable(ctx.guildId)) ? 'Link block is off' : 'Link block is already off');
    }

    try {
      await enable(ctx.guildId);
    } catch (error) {
      console.error(error);
      return ctx.edit('Link block could not be enabled, this server may have reached the AutoMod rule limit');
    }

    await ctx.edit(
      [
        'Link block is on',
        '> Links, domains, hidden dots like `site[.]com` and fancy fonts are blocked',
        '> GIFs and Discord message links still work',
        '> Admins and members with **Manage Server** are not affected',
      ].join('\n'),
    );
  },
};
