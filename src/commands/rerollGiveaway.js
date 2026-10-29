import { ContextMenuCommandBuilder } from '@discordjs/builders';
import { ApplicationCommandType, InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { findByMessage, reroll } from '../utils/giveaway.js';
import { memberCan } from '../utils/permissions.js';

export default {
  data: new ContextMenuCommandBuilder()
    .setName('Reroll Giveaway')
    .setType(ApplicationCommandType.Message)
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  async execute(ctx) {
    const giveaway = findByMessage(ctx.target.id);

    if (!giveaway) return ctx.reply('This is not a giveaway, or it is too old to reroll', true);
    if (ctx.userId !== giveaway.hostId && !memberCan(ctx, PermissionFlagsBits.ManageEvents))
      return ctx.reply('Only the host can reroll', true);
    if (!giveaway.ended) return ctx.reply('This giveaway has not ended yet', true);

    await ctx.defer(true);
    const winners = await reroll(giveaway.id);
    await ctx.edit(winners?.length ? `Rerolled, new winner <@${winners[0]}>` : 'No other valid entries to pick from');
  },
};
