import { api } from '../client.js';

export async function stripRoles(guild, bot, userId, mask, reason) {
  const member = await api.guilds.getMember(guild.id, userId).catch(() => null);
  if (!member) return false;

  const byId = new Map(guild.roles.map((r) => [r.id, r]));
  const strip = (role) => role && !role.managed && role.position < bot.highest && BigInt(role.permissions) & mask;

  const roles = member.roles.filter((id) => !strip(byId.get(id)));
  if (roles.length === member.roles.length) return false;

  await api.guilds.editMember(guild.id, userId, { roles }, { reason }).catch(console.error);
  return true;
}
