import { SlashCommandBuilder } from '@discordjs/builders';
import { InteractionContextType, PermissionFlagsBits, TextInputStyle } from '@discordjs/core';
import { textInput } from '../utils/components.js';
import {
  MAX_ACTIVE,
  MAX_DURATION,
  MIN_DURATION,
  activeCount,
  addEntry,
  getGiveaway,
  parseDuration,
  startGiveaway,
} from '../utils/giveaway.js';

const modal = {
  custom_id: 'giveaway:create',
  title: 'Create Giveaway',
  components: [
    textInput({ id: 'prize', label: 'Prize', placeholder: 'Nitro Classic', max_length: 100 }),
    textInput({ id: 'duration', label: 'Duration', placeholder: '30m, 2h, 1d 12h', max_length: 20 }),
    textInput({ id: 'winners', label: 'Winners', placeholder: '1', value: '1', max_length: 2 }),
    textInput({
      id: 'description',
      label: 'Description',
      style: TextInputStyle.Paragraph,
      placeholder: 'Optional details or requirements',
      max_length: 500,
      required: false,
    }),
  ],
};

async function create(ctx) {
  const seconds = parseDuration(ctx.field('duration') ?? '');
  const winners = Number(ctx.field('winners'));

  if (!seconds || seconds < MIN_DURATION || seconds > MAX_DURATION) {
    return ctx.reply('Duration must be between 1 minute and 30 days, like 30m, 2h or 1d 12h', true);
  }
  if (!Number.isInteger(winners) || winners < 1 || winners > 20) {
    return ctx.reply('Winners must be a number between 1 and 20', true);
  }
  if (activeCount(ctx.guildId) >= MAX_ACTIVE) {
    return ctx.reply(`This server already has ${MAX_ACTIVE} active giveaways`, true);
  }

  try {
    await startGiveaway({
      guildId: ctx.guildId,
      channelId: ctx.interaction.channel.id,
      hostId: ctx.userId,
      prize: ctx.field('prize'),
      description: ctx.field('description'),
      winners,
      seconds,
    });
  } catch {
    return ctx.reply('I cannot send messages in this channel', true);
  }

  await ctx.reply('Giveaway started', true);
}

async function join(ctx, id) {
  const giveaway = getGiveaway(id);
  if (!giveaway || giveaway.ended) return ctx.reply('This giveaway has ended', true);

  const joined = addEntry(id, ctx.userId);
  await ctx.reply(
    joined ? `You joined the giveaway for **${giveaway.prize}**` : 'You already joined this giveaway',
    true,
  );
}

export default {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start a giveaway in this channel')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  async execute(ctx) {
    await ctx.modal(modal);
  },

  async component(ctx, action, [id]) {
    switch (action) {
      case 'create':
        return create(ctx);
      case 'join':
        return join(ctx, Number(id));
    }
  },
};
