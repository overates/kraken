import { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationIntegrationType, InteractionContextType } from '@discordjs/core';
import { avatarMessage } from '../utils/profile.js';

export default {
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Show a user avatar in full size')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addUserOption((o) => o.setName('user').setDescription('Defaults to you')),

  async execute(ctx) {
    const user = ctx.user('user') ?? ctx.caller;
    const member = ctx.user('user') ? ctx.member('user') : ctx.interaction.member;
    await ctx.send(avatarMessage(user, member, ctx.guildId));
  },
};
