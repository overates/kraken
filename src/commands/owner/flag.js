import { SlashCommandBuilder } from '@discordjs/builders';
import { api } from '../../client.js';
import { textInput } from '../../utils/components.js';
import { addFlag, flagEmoji, setAlert } from '../../utils/flags.js';
import { propagate } from '../../utils/shield.js';
import { whoisCard } from '../../utils/whois.js';

const WANTED = process.env.WANTED_CHANNEL_ID;

async function announce(user, reason) {
  const { profile, color, file } = await whoisCard(user);

  return api.channels.createMessage(WANTED, {
    embeds: [
      {
        color,
        title: 'New Record',
        description: `<@${profile.id}> · \`${profile.id}\` · ${flagEmoji(reason)}**${reason}**`,
        image: { url: 'attachment://whois.png' },
        timestamp: new Date().toISOString(),
      },
    ],
    files: [file],
    allowed_mentions: { parse: [] },
  });
}

const modal = {
  custom_id: 'flag:submit',
  title: 'Flag User',
  components: [
    textInput({ id: 'user', label: 'User ID', placeholder: '123456789012345678', min_length: 17, max_length: 20 }),
    textInput({
      id: 'reason',
      label: 'Reason',
      placeholder: 'SCAM, FAKE MM, SPAM, PHISHING, RAID, DOXX, HATE',
      max_length: 50,
    }),
  ],
};

export default {
  data: new SlashCommandBuilder().setName('flag').setDescription('Flag a user'),

  async execute(ctx) {
    await ctx.modal(modal);
  },

  async component(ctx, action) {
    if (action !== 'submit') return;

    const id = ctx.field('user');
    const reason = ctx.field('reason');

    const user = /^\d{17,20}$/.test(id) ? await api.users.get(id).catch(() => null) : null;
    if (!user) return ctx.reply('User not found', true);

    await ctx.defer(true);

    const flag = addFlag(user.id, reason);

    const posted = await announce(user, reason).catch((error) => (console.error(error), null));
    if (posted) setAlert(flag.id, posted.id);

    const lines = [`${flagEmoji(reason)}Flagged <@${user.id}> · **${reason}**`];
    lines.push(posted ? `Posted in <#${WANTED}>` : `Could not post in <#${WANTED}>`);
    lines.push('Kraken Shield is banning them in protected servers');

    await ctx.edit(lines.join('\n'));

    propagate(user.id, reason).catch(console.error);
  },
};
