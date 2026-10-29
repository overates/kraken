import { SlashCommandBuilder } from '@discordjs/builders';
import { ChannelType, ComponentType, InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { plural } from '../utils/format.js';
import { fetchBot, has, ownedGuild } from '../utils/permissions.js';
import { SHIELD_CATEGORIES, banExisting, getShield, label, saveShield } from '../utils/shield.js';

const NEEDED = [PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ManageGuild];

function modal(shield) {
  const on = Boolean(shield);
  const categories = shield?.categories ?? new Set(SHIELD_CATEGORIES);
  const action = shield?.action ?? 'ban';

  return {
    custom_id: 'shield:save',
    title: 'Kraken Shield',
    components: [
      {
        type: ComponentType.Label,
        label: 'Status',
        component: {
          type: ComponentType.RadioGroup,
          custom_id: 'status',
          required: true,
          options: [
            { value: 'on', label: 'On', description: 'Block users flagged by Kraken', default: on || !shield },
            { value: 'off', label: 'Off', default: false },
          ],
        },
      },
      {
        type: ComponentType.Label,
        label: 'Block',
        description: 'Flag categories to block',
        component: {
          type: ComponentType.CheckboxGroup,
          custom_id: 'categories',
          min_values: 1,
          max_values: SHIELD_CATEGORIES.length,
          options: SHIELD_CATEGORIES.map((c) => ({ value: c, label: label(c), default: categories.has(c) })),
        },
      },
      {
        type: ComponentType.Label,
        label: 'Action',
        component: {
          type: ComponentType.RadioGroup,
          custom_id: 'action',
          required: true,
          options: [
            { value: 'ban', label: 'Ban', description: 'Also bans them before they join', default: action === 'ban' },
            { value: 'kick', label: 'Kick', description: 'Kicks them when they join', default: action === 'kick' },
          ],
        },
      },
      {
        type: ComponentType.Label,
        label: 'Alert channel',
        description: 'Optional, where blocked users are posted',
        component: {
          type: ComponentType.ChannelSelect,
          custom_id: 'alert',
          channel_types: [ChannelType.GuildText],
          min_values: 0,
          max_values: 1,
          required: false,
          ...(shield?.alertChannel && { default_values: [{ id: shield.alertChannel, type: 'channel' }] }),
        },
      },
    ],
  };
}

async function save(ctx) {
  const guild = await ownedGuild(ctx);
  if (!guild) return ctx.reply('Only the server owner can use Kraken Shield', true);

  const on = ctx.field('status') === 'on';
  const categories = on ? ctx.values('categories').filter((c) => SHIELD_CATEGORIES.includes(c)) : [];
  const action = ctx.field('action') === 'kick' ? 'kick' : 'ban';

  if (categories.length) {
    const bot = await fetchBot(ctx.guildId, ctx.botId, guild.roles);
    if (!has(bot.base, ...NEEDED))
      return ctx.reply('I need **Ban Members**, **Kick Members** and **Manage Server**', true);
  }

  await ctx.defer(true);

  const shield = saveShield(ctx.guildId, { categories, action, alertChannel: ctx.values('alert')[0] ?? null });
  if (!shield) return ctx.edit('Kraken Shield is off');

  const banned = await banExisting(ctx.guildId, shield);
  const lines = [
    'Kraken Shield is on',
    `> Blocking ${[...shield.categories].map((c) => `**${label(c)}**`).join(', ')}`,
    `> Action **${action === 'ban' ? 'Ban' : 'Kick'}**${shield.alertChannel ? ` · alerts in <#${shield.alertChannel}>` : ''}`,
    ...(banned ? [`> Banned ${plural(banned, 'flagged user')} right away`] : []),
  ];

  await ctx.edit(lines.join('\n'));
}

export default {
  data: new SlashCommandBuilder()
    .setName('shield')
    .setDescription('Block users flagged by Kraken across servers')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(ctx) {
    if (!(await ownedGuild(ctx))) return ctx.reply('Only the server owner can use Kraken Shield', true);
    await ctx.modal(modal(getShield(ctx.guildId)));
  },

  async component(ctx, action) {
    if (action === 'save') return save(ctx);
  },
};
