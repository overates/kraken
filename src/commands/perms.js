import { SlashCommandBuilder } from '@discordjs/builders';
import {
  GuildExplicitContentFilter,
  GuildMFALevel,
  GuildVerificationLevel,
  InteractionContextType,
  PermissionFlagsBits,
} from '@discordjs/core';
import { api } from '../client.js';
import { fit } from '../utils/format.js';
import { has } from '../utils/permissions.js';

const DANGEROUS = {
  ManageGuild: 'Manage Server',
  ManageRoles: 'Manage Roles',
  ManageChannels: 'Manage Channels',
  ManageWebhooks: 'Manage Webhooks',
  BanMembers: 'Ban Members',
  KickMembers: 'Kick Members',
  ModerateMembers: 'Timeout Members',
  ManageMessages: 'Manage Messages',
  MentionEveryone: 'Mention Everyone',
  ManageGuildExpressions: 'Manage Expressions',
};

function dangerous(bits) {
  const perms = BigInt(bits);
  if (has(perms, PermissionFlagsBits.Administrator)) return '`Administrator`';

  return Object.keys(DANGEROUS)
    .filter((p) => has(perms, PermissionFlagsBits[p]))
    .map((p) => `\`${DANGEROUS[p]}\``)
    .join(' ');
}

const section = (title, lines) => (lines.length ? [`**${title}**`, ...lines, ''] : []);

export default {
  data: new SlashCommandBuilder()
    .setName('perms')
    .setDescription('List dangerous permissions')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(ctx) {
    await ctx.defer(true);

    const [guild, channels] = await Promise.all([api.guilds.get(ctx.guildId), api.guilds.getChannels(ctx.guildId)]);

    const server = [
      guild.mfa_level === GuildMFALevel.None && '2FA for moderation is off',
      guild.verification_level <= GuildVerificationLevel.Low && 'Verification level is low',
      guild.explicit_content_filter === GuildExplicitContentFilter.Disabled && 'Explicit content filter is off',
    ].filter(Boolean);

    const roles = guild.roles
      .sort((a, b) => b.position - a.position)
      .map((role) => [role, dangerous(role.permissions)])
      .filter(([, perms]) => perms)
      .map(([role, perms]) => {
        const name = role.id === guild.id ? '@everyone' : `<@&${role.id}>`;
        return `${name}${role.managed ? ' · bot' : ''} — ${perms}`;
      });

    const overrides = channels
      .map((channel) => [channel, channel.permission_overwrites?.find((o) => o.id === guild.id)])
      .filter(([, everyone]) => everyone)
      .map(([channel, everyone]) => [channel, dangerous(everyone.allow)])
      .filter(([, perms]) => perms)
      .map(([channel, perms]) => `<#${channel.id}> — ${perms}`);

    const lines = [
      ...section('Server', server),
      ...section('Roles', roles),
      ...section('@everyone in channels', overrides),
    ];

    await ctx.edit(lines.length ? fit(lines) : 'No dangerous permissions found');
  },
};
