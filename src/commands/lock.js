import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { api } from '../client.js';
import { plural } from '../utils/format.js';
import { LOCKABLE, canManage, channelChoices, isLocked, lock, lockAll } from '../utils/lock.js';
import { fetchBot, has } from '../utils/permissions.js';

const PERMISSIONS = '**Manage Channel** and **Manage Permissions**';

const fetchChannel = (id) => (/^\d{17,20}$/.test(id) ? api.channels.get(id).catch(() => null) : null);

export default {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel or all channels')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((o) => o.setName('channel').setDescription('Defaults to this channel').setAutocomplete(true)),

  async autocomplete(ctx) {
    await ctx.choices(await channelChoices(ctx.guildId, ctx.focused.value, false));
  },

  async execute(ctx) {
    const value = ctx.option('channel');

    if (value === 'all') {
      await ctx.defer();

      const bot = await fetchBot(ctx.guildId, ctx.botId);
      if (!has(bot.base, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles)) {
        return ctx.edit(`I need ${PERMISSIONS}`);
      }

      const count = await lockAll(ctx.guildId, ctx.botId);
      return ctx.edit(count ? `Locked ${plural(count, 'channel')}` : 'No channels to lock');
    }

    const channel = await fetchChannel(value ?? ctx.interaction.channel.id);

    if (channel?.guild_id !== ctx.guildId) {
      return ctx.reply('Channel not found');
    }
    if (!LOCKABLE.includes(channel.type)) {
      return ctx.reply('This channel cannot be locked');
    }

    const bot = await fetchBot(ctx.guildId, ctx.botId);

    if (!canManage(bot, channel)) {
      return ctx.reply(`I need ${PERMISSIONS} in <#${channel.id}>`);
    }
    if (isLocked(channel.id)) {
      return ctx.reply(`<#${channel.id}> is already locked`);
    }

    await lock(channel);

    await ctx.reply(`<#${channel.id}> has been locked`);
  },
};
