import { ContextMenuCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandType, ApplicationIntegrationType, InteractionContextType } from '@discordjs/core';
import { bannerMessage } from '../utils/profile.js';

export default {
  cooldown: 3,

  data: new ContextMenuCommandBuilder()
    .setName('Banner')
    .setType(ApplicationCommandType.User)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(ctx) {
    await ctx.defer();
    await ctx.editMessage(await bannerMessage(ctx.targetUser));
  },
};
