import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { api } from '../client.js';
import { plural } from '../utils/format.js';
import { freeze, isFrozen, unfreeze } from '../utils/freeze.js';
import { fetchBot, has, ownedGuild } from '../utils/permissions.js';

const summary = (roles, channels) => `${plural(roles, 'role')} and ${plural(channels, 'channel permission')}`;

export default {
  data: new SlashCommandBuilder()
    .setName('freeze')
    .setDescription('Temporarily remove all dangerous permissions')
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
    if (!guild) return ctx.reply('Only the server owner can use freeze', true);

    await ctx.defer();

    const bot = await fetchBot(ctx.guildId, ctx.botId, guild.roles);
    if (!has(bot.base, PermissionFlagsBits.Administrator)) {
      return ctx.edit('I need **Administrator**');
    }

    const frozen = isFrozen(ctx.guildId);

    if (ctx.option('status') === 'off') {
      if (!frozen) return ctx.edit('Server is not frozen');

      const { roleCount, channelCount } = await unfreeze(ctx.guildId);
      return ctx.edit(`Server is unfrozen\nRestored ${summary(roleCount, channelCount)}`);
    }

    if (frozen) return ctx.edit('Server is already frozen');

    const channels = await api.guilds.getChannels(ctx.guildId);
    const { roleCount, channelCount, above } = await freeze(guild, channels, bot);

    const lines = [`Server is frozen\nRemoved permissions from ${summary(roleCount, channelCount)}`];
    if (above.length) {
      lines.push(`${above.map((id) => `<@&${id}>`).join(' ')} · above my role, move me higher`);
    }

    await ctx.edit(lines.join('\n'));
  },
};
