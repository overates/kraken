import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { api } from '../client.js';
import { plural } from '../utils/format.js';
import { LOCKABLE, canManage, channelChoices, isLocked, unlock, unlockAll } from '../utils/lock.js';
import { fetchBot, has } from '../utils/permissions.js';

const PERMISSIONS = '**Manage Channel** and **Manage Permissions**';

const fetchChannel = (id) => (/^\d{17,20}$/.test(id) ? api.channels.get(id).catch(() => null) : null);

export default {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a channel or all channels')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((o) => o.setName('channel').setDescription('Defaults to this channel').setAutocomplete(true)),

  async autocomplete(ctx) {
    await ctx.choices(await channelChoices(ctx.guildId, ctx.focused.value, true));
  },

  async execute(ctx) {
    const value = ctx.option('channel');

    if (value === 'all') {
      await ctx.defer();

      const bot = await fetchBot(ctx.guildId, ctx.botId);
      if (!has(bot.base, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles)) {
        return ctx.edit(`I need ${PERMISSIONS}`);
      }

      const count = await unlockAll(ctx.guildId, ctx.botId);
      return ctx.edit(count ? `Unlocked ${plural(count, 'channel')}` : 'No channels to unlock');
    }

    const channel = await fetchChannel(value ?? ctx.interaction.channel.id);

    if (channel?.guild_id !== ctx.guildId) {
      return ctx.reply('Channel not found');
    }
    if (!LOCKABLE.includes(channel.type)) {
      return ctx.reply('This channel cannot be unlocked');
    }

    const bot = await fetchBot(ctx.guildId, ctx.botId);

    if (!canManage(bot, channel)) {
      return ctx.reply(`I need ${PERMISSIONS} in <#${channel.id}>`);
    }
    if (!isLocked(channel.id)) {
      return ctx.reply(`<#${channel.id}> is not locked`);
    }

    await unlock(channel);

    await ctx.reply(`<#${channel.id}> has been unlocked`);
  },
};
