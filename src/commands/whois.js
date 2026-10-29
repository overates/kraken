import { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationIntegrationType, InteractionContextType } from '@discordjs/core';
import { replyWhois } from '../utils/whois.js';

export default {
  cooldown: 3,

  data: new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Show the record of a user')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
    .addUserOption((o) => o.setName('user').setDescription('User or ID').setRequired(true)),

  async execute(ctx) {
    await replyWhois(ctx, ctx.user('user'));
  },
};
