import { PermissionFlagsBits } from '@discordjs/core';
import { api } from '../client.js';

const ALL = Object.values(PermissionFlagsBits).reduce((a, b) => a | b, 0n);

export const has = (perms, ...flags) => flags.every((flag) => (perms & flag) === flag);

function basePermissions(roles, roleIds, guildId) {
  const byId = new Map(roles.map((r) => [r.id, r]));
  let perms = BigInt(byId.get(guildId)?.permissions ?? 0);

  for (const id of roleIds) perms |= BigInt(byId.get(id)?.permissions ?? 0);

  return perms & PermissionFlagsBits.Administrator ? ALL : perms;
}

// Same order Discord uses: @everyone overwrite, then all role overwrites together, then the member overwrite
function channelPermissions(base, channel, roleIds = [], memberId = null) {
  if (base & PermissionFlagsBits.Administrator) return ALL;

  const overwrites = new Map((channel.permission_overwrites ?? []).map((o) => [o.id, o]));
  const apply = (perms, allow, deny) => (perms & ~BigInt(deny)) | BigInt(allow);

  const everyone = overwrites.get(channel.guild_id);
  let perms = everyone ? apply(base, everyone.allow, everyone.deny) : base;

  let allow = 0n;
  let deny = 0n;
  for (const id of roleIds) {
    const o = overwrites.get(id);
    if (o) {
      allow |= BigInt(o.allow);
      deny |= BigInt(o.deny);
    }
  }
  perms = apply(perms, allow, deny);

  const member = memberId && overwrites.get(memberId);
  return member ? apply(perms, member.allow, member.deny) : perms;
}

export function highest(roles, roleIds) {
  const positions = new Map(roles.map((r) => [r.id, r.position]));
  return Math.max(0, ...roleIds.map((id) => positions.get(id) ?? 0));
}

export async function fetchBot(guildId, botId, roles) {
  const [guildRoles, me] = await Promise.all([
    roles ?? api.guilds.getRoles(guildId),
    api.guilds.getMember(guildId, botId),
  ]);
  const base = basePermissions(guildRoles, me.roles, guildId);

  return {
    base,
    roles: me.roles,
    highest: highest(guildRoles, me.roles),
    in: (channel) => channelPermissions(base, channel, me.roles, botId),
  };
}

export function everyoneIn(roles, channel) {
  const everyone = roles.find((r) => r.id === channel.guild_id);
  return channelPermissions(BigInt(everyone?.permissions ?? 0), channel);
}

export async function ownedGuild(ctx) {
  const guild = await api.guilds.get(ctx.guildId);
  return ctx.userId === guild.owner_id ? guild : null;
}

export function memberCan(ctx, ...flags) {
  const perms = BigInt(ctx.interaction.member?.permissions ?? 0);
  return has(perms, PermissionFlagsBits.Administrator) || has(perms, ...flags);
}
