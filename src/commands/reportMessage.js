import { ContextMenuCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandType, ApplicationIntegrationType, InteractionContextType } from '@discordjs/core';
import { BLOCKED, LIMIT_REACHED, isBlocked, messageModal, pending, remaining } from '../utils/reports.js';

export default {
  data: new ContextMenuCommandBuilder()
    .setName('Report Message')
    .setType(ApplicationCommandType.Message)
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(ctx) {
    const message = ctx.target;

    if (isBlocked(ctx.userId)) return ctx.reply(BLOCKED, true);
    if (remaining(ctx.userId) <= 0) return ctx.reply(LIMIT_REACHED, true);

    pending.set(ctx.userId, {
      id: message.id,
      channel_id: message.channel_id,
      guild_id: ctx.guildId,
      timestamp: message.timestamp,
      content: message.content,
      author: { id: message.author.id, username: message.author.username, avatar: message.author.avatar },
      mentions: Object.fromEntries((message.mentions ?? []).map((u) => [u.id, u.username])),
      attachments: message.attachments.map(({ url, filename, content_type, size }) => ({
        url,
        filename,
        content_type,
        size,
      })),
    });

    await ctx.modal(messageModal);
  },
};
