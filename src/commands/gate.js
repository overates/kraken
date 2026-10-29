import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { describe, getGate, setGate } from '../utils/gate.js';
import { fetchBot, has, ownedGuild } from '../utils/permissions.js';

const PERMISSION = { ban: PermissionFlagsBits.BanMembers, kick: PermissionFlagsBits.KickMembers };

export default {
  data: new SlashCommandBuilder()
    .setName('gate')
    .setDescription('Set join rules')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((o) =>
      o.setName('age').setDescription('Minimum account age in days, 0 to turn off').setMinValue(0).setMaxValue(365),
    )
    .addBooleanOption((o) => o.setName('avatar').setDescription('Require an avatar'))
    .addStringOption((o) =>
      o
        .setName('action')
        .setDescription('What to do with members who fail')
        .addChoices({ name: 'Ban', value: 'ban' }, { name: 'Kick', value: 'kick' }),
    ),

  async execute(ctx) {
    const guild = await ownedGuild(ctx);
    if (!guild) return ctx.reply('Only the server owner can set the gate', true);

    const current = getGate(ctx.guildId);
    const [age, avatar, action] = ['age', 'avatar', 'action'].map((name) => ctx.option(name));

    if (age === undefined && avatar === undefined && action === undefined) {
      return ctx.reply(describe(current));
    }

    const settings = {
      minAge: age ?? current?.minAge ?? 0,
      avatar: avatar ?? current?.avatar ?? false,
      action: action ?? current?.action ?? 'ban',
    };

    const bot = await fetchBot(ctx.guildId, ctx.botId, guild.roles);
    if ((settings.minAge || settings.avatar) && !has(bot.base, PERMISSION[settings.action])) {
      return ctx.reply(`I need **${settings.action === 'ban' ? 'Ban' : 'Kick'} Members**`);
    }

    await ctx.reply(describe(setGate(ctx.guildId, settings)));
  },
};
