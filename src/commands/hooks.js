import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits, RESTJSONErrorCodes, WebhookType } from '@discordjs/core';
import { api } from '../client.js';
import { createdAt, fit, plural, timestamp } from '../utils/format.js';

function describe(webhook) {
  const source =
    webhook.type === WebhookType.ChannelFollower
      ? `follows ${webhook.source_guild?.name ?? 'another server'}`
      : webhook.user
        ? `by <@${webhook.user.id}>`
        : 'unknown creator';

  return [`\`${webhook.name}\``, source, timestamp(createdAt(webhook.id))].join(' · ');
}

export default {
  data: new SlashCommandBuilder()
    .setName('hooks')
    .setDescription('List server webhooks')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(ctx) {
    await ctx.defer(true);

    const webhooks = await api.guilds.getWebhooks(ctx.guildId).catch((error) => {
      if (error.code === RESTJSONErrorCodes.MissingPermissions) return null;
      throw error;
    });

    if (!webhooks) return ctx.edit('I need **Manage Webhooks**');
    if (!webhooks.length) return ctx.edit('No webhooks found');

    const channels = Map.groupBy(
      webhooks.sort((a, b) => createdAt(b.id) - createdAt(a.id)),
      (webhook) => webhook.channel_id,
    );

    const lines = [`${plural(webhooks.length, 'webhook')} in ${plural(channels.size, 'channel')}`, ''];

    for (const [channelId, list] of channels) {
      lines.push(`**<#${channelId}>**`, ...list.map(describe), '');
    }

    await ctx.edit(fit(lines));
  },
};
