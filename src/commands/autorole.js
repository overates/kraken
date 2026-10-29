import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { autoroles } from '../utils/autorole.js';
import { fetchBot, has } from '../utils/permissions.js';

export default {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Set the role given to new members')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addRoleOption((o) => o.setName('role').setDescription('Role to give').setRequired(true)),

  async execute(ctx) {
    const role = ctx.role('role');

    if (role.id === ctx.guildId || role.managed) {
      return ctx.reply('This role cannot be assigned', true);
    }

    const bot = await fetchBot(ctx.guildId, ctx.botId);

    if (!has(bot.base, PermissionFlagsBits.ManageRoles)) {
      return ctx.reply('I need the **Manage Roles** permission', true);
    }
    if (role.position >= bot.highest) {
      return ctx.reply(`<@&${role.id}> is higher than my highest role`, true);
    }

    autoroles.set(ctx.guildId, role.id);

    await ctx.reply(`New members will now receive <@&${role.id}>`);
  },
};
