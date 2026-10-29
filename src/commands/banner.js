import { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationIntegrationType, InteractionContextType } from '@discordjs/core';
import { bannerMessage } from '../utils/profile.js';

export default {
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('banner')
    .setDescription('Show a user banner in full size')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addUserOption((o) => o.setName('user').setDescription('Defaults to you')),

  async execute(ctx) {
    await ctx.defer();
    await ctx.editMessage(await bannerMessage(ctx.user('user') ?? ctx.caller));
  },
};
