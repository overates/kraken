import { ContextMenuCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandType, ApplicationIntegrationType, InteractionContextType } from '@discordjs/core';
import { replyWhois } from '../utils/whois.js';

export default {
  cooldown: 3,

  data: new ContextMenuCommandBuilder()
    .setName('Whois Author')
    .setType(ApplicationCommandType.Message)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(ctx) {
    await replyWhois(ctx, ctx.target.author);
  },
};
