import { SlashCommandBuilder } from '@discordjs/builders';
import { api } from '../../client.js';
import { clearFlags, getFlags } from '../../utils/flags.js';
import { plural } from '../../utils/format.js';
import { revoke } from '../../utils/shield.js';

export default {
  data: new SlashCommandBuilder()
    .setName('unflag')
    .setDescription('Remove all flags from a user')
    .addUserOption((o) => o.setName('user').setDescription('User or ID').setRequired(true)),

  async execute(ctx) {
    const user = ctx.user('user');
    await ctx.defer(true);

    const flags = getFlags(user.id);

    await Promise.all(
      flags
        .filter((f) => f.messageId)
        .map((f) => api.channels.deleteMessage(process.env.WANTED_CHANNEL_ID, f.messageId).catch(() => {})),
    );

    const count = clearFlags(user.id);
    const unbanned = await revoke(user.id);

    const lines = [count ? `Removed ${plural(count, 'flag')} from <@${user.id}>` : `<@${user.id}> has no flags`];
    if (unbanned) lines.push(`Kraken Shield unbanned them in ${plural(unbanned, 'server')}`);

    await ctx.edit(lines.join('\n'));
  },
};
