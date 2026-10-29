import { SlashCommandBuilder } from '@discordjs/builders';
import { ChannelType, ComponentType, InteractionContextType, MessageFlags, PermissionFlagsBits } from '@discordjs/core';
import { api } from '../client.js';
import { autoroles } from '../utils/autorole.js';
import { captchaCode, renderCaptcha } from '../utils/captcha.js';
import { button, embed, row, textInput } from '../utils/components.js';
import { cooldown } from '../utils/cooldown.js';
import { fetchBot, has, ownedGuild } from '../utils/permissions.js';
import {
  checkSignature,
  disable,
  enable,
  expired,
  expiry,
  getVerification,
  normalize,
  sign,
} from '../utils/verification.js';

const NEEDED = [PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels];
const NOT_OWNER = 'Only the server owner can set up verification';
const NO_AUTOROLE = 'Set an autorole first with **/autorole**, new members get it before verifying';

function setupModal(config) {
  return {
    custom_id: 'verification:save',
    title: 'Verification',
    components: [
      {
        type: ComponentType.Label,
        label: 'Status',
        component: {
          type: ComponentType.RadioGroup,
          custom_id: 'status',
          required: true,
          options: [
            { value: 'on', label: 'On', default: true },
            { value: 'off', label: 'Off', default: false },
          ],
        },
      },
      {
        type: ComponentType.Label,
        label: 'Verify channel',
        description: 'Only the autorole can see it',
        component: {
          type: ComponentType.ChannelSelect,
          custom_id: 'channel',
          channel_types: [ChannelType.GuildText],
          min_values: 1,
          max_values: 1,
          ...(config?.channelId && { default_values: [{ id: config.channelId, type: 'channel' }] }),
        },
      },
      {
        type: ComponentType.Label,
        label: 'Verified role',
        description: 'Given after verifying, the autorole is removed',
        component: {
          type: ComponentType.RoleSelect,
          custom_id: 'role',
          min_values: 1,
          max_values: 1,
          ...(config?.roleId && { default_values: [{ id: config.roleId, type: 'role' }] }),
        },
      },
    ],
  };
}

async function save(ctx) {
  const guild = await ownedGuild(ctx);
  if (!guild) return ctx.reply(NOT_OWNER, true);

  if (ctx.field('status') !== 'on') {
    await ctx.defer(true);
    return ctx.edit((await disable(ctx.guildId)) ? 'Verification is off' : 'Verification is already off');
  }

  const channelId = ctx.values('channel')[0];
  const roleId = ctx.values('role')[0];
  const unverifiedRoleId = autoroles.get(ctx.guildId);
  const bot = await fetchBot(ctx.guildId, ctx.botId, guild.roles);

  if (!unverifiedRoleId) return ctx.reply(NO_AUTOROLE, true);
  if (!has(bot.base, ...NEEDED)) return ctx.reply('I need **Manage Roles** and **Manage Channels**', true);
  if (unverifiedRoleId === roleId) return ctx.reply('The verified role must be different from the autorole', true);

  for (const id of [unverifiedRoleId, roleId]) {
    const role = guild.roles.find((r) => r.id === id);
    if (!role || role.managed || role.id === ctx.guildId) return ctx.reply('This role cannot be used', true);
    if (role.position >= bot.highest) return ctx.reply(`<@&${role.id}> is higher than my highest role`, true);
  }

  await ctx.defer(true);
  await enable(ctx.guildId, { channelId, unverifiedRoleId, roleId });

  await ctx.edit(
    [
      'Verification is on',
      `> Captcha panel in <#${channelId}>`,
      `> New members get <@&${unverifiedRoleId}> and only see <#${channelId}>`,
      `> After verifying they get <@&${roleId}> and lose <@&${unverifiedRoleId}>`,
    ].join('\n'),
  );
}

const isVerified = (ctx, config) => ctx.interaction.member?.roles?.includes(config.roleId);

// Replaces the captcha message so the image disappears once it is answered
function finish(ctx, text) {
  const body = { embeds: [embed(text)], components: [], attachments: [] };
  return ctx.interaction.message?.flags & MessageFlags.Ephemeral ? ctx.update(body) : ctx.send(body, true);
}

async function pass(ctx, config) {
  const reason = { reason: 'Verified' };
  await api.guilds.addRoleToMember(ctx.guildId, ctx.userId, config.roleId, reason);
  await api.guilds.removeRoleFromMember(ctx.guildId, ctx.userId, config.unverifiedRoleId, reason).catch(() => {});
  return finish(ctx, 'You are verified, welcome');
}

async function start(ctx) {
  const config = getVerification(ctx.guildId);
  if (!config) return ctx.reply('Verification is not set up', true);
  if (isVerified(ctx, config)) return ctx.reply('You are already verified', true);

  const wait = cooldown(`verification:${ctx.guildId}:${ctx.userId}`, 5);
  if (wait) return ctx.reply(`Try again in ${wait}s`, true);

  const exp = expiry();
  const code = captchaCode();
  const image = await renderCaptcha(code);

  return ctx.send(
    {
      embeds: [
        {
          ...embed('Type the code from the image, it is not case sensitive'),
          image: { url: 'attachment://captcha.png' },
        },
      ],
      components: [row(button(`verification:code:${exp}:${sign(ctx.guildId, ctx.userId, code, exp)}`, 'Enter code'))],
      files: [{ name: 'captcha.png', data: image, contentType: 'image/png' }],
    },
    true,
  );
}

async function challenge(ctx, exp) {
  const config = getVerification(ctx.guildId);
  if (!config) {
    await ctx.reply('Verification is not set up', true);
    return null;
  }
  if (expired(exp)) {
    await ctx.reply('This challenge expired, click **Verify** again', true);
    return null;
  }
  return config;
}

async function openCodeModal(ctx, [exp, signature]) {
  if (!(await challenge(ctx, exp))) return;

  await ctx.modal({
    custom_id: `verification:answer:${exp}:${signature}`,
    title: 'Verification',
    components: [textInput({ id: 'answer', label: 'Code from the image', max_length: 8 })],
  });
}

async function checkAnswer(ctx, [exp, signature]) {
  const config = await challenge(ctx, exp);
  if (!config) return;

  const correct = checkSignature(signature, ctx.guildId, ctx.userId, normalize(ctx.field('answer')), exp);
  return correct ? pass(ctx, config) : finish(ctx, 'Wrong answer, click **Verify** to try again');
}

export default {
  data: new SlashCommandBuilder()
    .setName('verification')
    .setDescription('Make new members verify before they see the server')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(ctx) {
    if (!(await ownedGuild(ctx))) return ctx.reply(NOT_OWNER, true);
    if (!autoroles.get(ctx.guildId)) return ctx.reply(NO_AUTOROLE, true);

    await ctx.modal(setupModal(getVerification(ctx.guildId)));
  },

  async component(ctx, action, args) {
    switch (action) {
      case 'save':
        return save(ctx);
      case 'start':
        return start(ctx);
      case 'code':
        return openCodeModal(ctx, args);
      case 'answer':
        return checkAnswer(ctx, args);
    }
  },
};
