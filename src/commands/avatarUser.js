import { ContextMenuCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandType, ApplicationIntegrationType, InteractionContextType } from '@discordjs/core';
import { avatarMessage } from '../utils/profile.js';

export default {
  cooldown: 3,

  data: new ContextMenuCommandBuilder()
    .setName('Avatar')
    .setType(ApplicationCommandType.User)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(ctx) {
    const member = ctx.interaction.data.resolved?.members?.[ctx.targetUser.id];
    await ctx.send(avatarMessage(ctx.targetUser, member, ctx.guildId));
  },
};
