import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { disable, enable } from '../utils/antispam.js';
import { fetchBot, has } from '../utils/permissions.js';

const tags = (list) => list.map((label) => `\`${label}\``).join(' ');

export default {
  data: new SlashCommandBuilder()
    .setName('antispam')
    .setDescription('Turn antispam on or off')
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
    if (!has(bot.base, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ModerateMembers)) {
      return ctx.edit('I need **Manage Server** and **Timeout Members**');
    }

    if (ctx.option('status') === 'off') {
      const removed = await disable(ctx.guildId);
      return ctx.edit(removed ? 'Antispam is off' : 'Antispam is already off');
    }

    const { active, covered, failed } = await enable(ctx.guildId);

    const lines = [active.length ? `Antispam is on\n\n${tags(active)}` : 'Antispam could not be enabled'];
    if (covered.length) lines.push(`${tags(covered)} · already covered by another rule`);
    if (failed.length) lines.push(`${tags(failed)} · could not be set up`);

    await ctx.edit(lines.join('\n'));
  },
};
