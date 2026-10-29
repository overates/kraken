import { SlashCommandBuilder } from '@discordjs/builders';
import { ComponentType, InteractionContextType, PermissionFlagsBits, TextInputStyle } from '@discordjs/core';
import { api } from '../client.js';
import { createBackup, downloadBackup, loadBackup } from '../utils/backup.js';
import { embed } from '../utils/components.js';
import { remaining, start } from '../utils/cooldown.js';
import { plural } from '../utils/format.js';
import { createLimiter } from '../utils/limit.js';
import { fetchBot, has, ownedGuild } from '../utils/permissions.js';

const COOLDOWN = 300;
const BUSY = 'Kraken is busy with other backups, try again in a minute';
const heavy = createLimiter(2, 20);

function claim(ctx, kind) {
  const keys = [`backup:${kind}:guild:${ctx.guildId}`, `backup:${kind}:user:${ctx.userId}`];
  const wait = Math.max(...keys.map(remaining));
  if (wait) return `Backup ${kind} can be used again in ${Math.ceil(wait / 60)} min`;

  for (const key of keys) start(key, COOLDOWN);
  return null;
}

const summary = (s) =>
  [
    plural(s.roles, 'role'),
    plural(s.channels, 'channel'),
    plural(s.emojis, 'emoji'),
    plural(s.stickers, 'sticker'),
    plural(s.automod, 'automod rule'),
    plural(s.bans, 'ban'),
  ].join(' · ');
const loading = new Set();

const modal = {
  custom_id: 'backup:load',
  title: 'Load Backup',
  components: [
    {
      type: ComponentType.Label,
      label: 'Backup file',
      description: 'The .kraken file from /backup create',
      component: { type: ComponentType.FileUpload, custom_id: 'file', min_values: 1, max_values: 1, required: true },
    },
    {
      type: ComponentType.Label,
      label: 'Type LOAD to confirm',
      description: 'Current channels, roles, emojis and stickers will be deleted',
      component: {
        type: ComponentType.TextInput,
        custom_id: 'confirm',
        style: TextInputStyle.Short,
        placeholder: 'LOAD',
        max_length: 10,
        required: true,
      },
    },
  ],
};

async function notifyOwner(guild, text) {
  const dm = await api.users.createDM(guild.owner_id);
  await api.channels.createMessage(dm.id, { embeds: [embed(text)] });
}

async function create(ctx) {
  if (heavy.busy) return ctx.reply(BUSY, true);

  const blocked = claim(ctx, 'create');
  if (blocked) return ctx.reply(blocked, true);

  await ctx.defer(true);

  const { name, data, stats } = await heavy.run(() => createBackup(ctx.guildId));

  const lines = [
    'Backup created',
    `> ${summary(stats)}`,
    ...(stats.skipped ? [`> ${plural(stats.skipped, 'image')} skipped, the file would be too large`] : []),
    '> Keep this file safe, we do not store it',
  ];

  await ctx.editMessage({
    embeds: [embed(lines.join('\n'))],
    files: [{ name, data, contentType: 'application/octet-stream' }],
  });
}

async function submit(ctx) {
  const guild = await ownedGuild(ctx);
  if (!guild) return ctx.reply('Only the server owner can load a backup', true);
  if (ctx.field('confirm')?.toUpperCase() !== 'LOAD')
    return ctx.reply('Backup was not loaded, type LOAD to confirm', true);
  if (loading.has(ctx.guildId)) return ctx.reply('A backup is already loading', true);
  if (heavy.busy) return ctx.reply(BUSY, true);

  const bot = await fetchBot(ctx.guildId, ctx.botId, guild.roles);
  if (!has(bot.base, PermissionFlagsBits.Administrator)) return ctx.reply('I need **Administrator**', true);

  await ctx.defer(true);

  const data = await heavy.run(() => downloadBackup(ctx.attachments('file')[0]));
  if (!data) return ctx.edit('This is not a valid Kraken backup file');

  const blocked = claim(ctx, 'load');
  if (blocked) return ctx.edit(blocked);

  await ctx.edit('Loading backup, this can take a few minutes\nI will DM you when it is done');

  loading.add(ctx.guildId);
  try {
    const stats = await loadBackup(ctx.guildId, data, bot);
    const lines = [
      `Backup loaded in **${data.server.name}**`,
      `> ${summary(stats)}`,
      ...(stats.failed ? [`> ${plural(stats.failed, 'item')} could not be restored`] : []),
    ];
    await notifyOwner(guild, lines.join('\n')).catch(() => {});
  } catch (error) {
    console.error(error);
    await notifyOwner(guild, 'Backup could not be loaded').catch(() => {});
  } finally {
    loading.delete(ctx.guildId);
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Back up or restore the server')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) =>
      o
        .setName('action')
        .setDescription('Create downloads a backup, load replaces the server with one')
        .setRequired(true)
        .addChoices({ name: 'Create', value: 'create' }, { name: 'Load', value: 'load' }),
    ),

  async execute(ctx) {
    if (ctx.option('action') === 'create') return create(ctx);

    if (!(await ownedGuild(ctx))) return ctx.reply('Only the server owner can load a backup', true);
    await ctx.modal(modal);
  },

  async component(ctx, action) {
    if (action === 'load') return submit(ctx);
  },
};
