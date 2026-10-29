import { ComponentType } from '@discordjs/core';
import { api, rest } from '../client.js';
import { COLOR } from '../context.js';
import { avatarUrl } from './cdn.js';
import { embed, linkButton } from './components.js';

const VIEW = 1024;
const DOWNLOAD = 4096;

function downloads(make, hash) {
  const formats = ['png', 'jpg', 'webp', ...(hash.startsWith('a_') ? ['gif'] : [])];
  return [
    {
      type: ComponentType.ActionRow,
      components: formats.map((ext) =>
        linkButton(ext.toUpperCase(), make({ size: DOWNLOAD, extension: ext, forceStatic: ext !== 'gif' })),
      ),
    },
  ];
}

const card = (description, url) => ({ ...embed(description), image: { url } });

export function avatarMessage(user, member, guildId) {
  const name = `**${user.username}**`;

  if (!user.avatar) {
    return { embeds: [card(`${name} · default avatar`, avatarUrl(user))] };
  }

  const global = (options) => rest.cdn.avatar(user.id, user.avatar, options);
  const embeds = [];

  if (member?.avatar && guildId) {
    const server = (options) => rest.cdn.guildMemberAvatar(guildId, user.id, member.avatar, options);
    embeds.push(card(`${name} · server avatar`, server({ size: VIEW })));
  }
  embeds.push(card(`${name} · avatar`, global({ size: VIEW })));

  return { embeds, components: downloads(global, user.avatar) };
}

export async function bannerMessage(user) {
  const profile = await api.users.get(user.id);
  const name = `**${profile.username}**`;

  if (!profile.banner) {
    const accent = profile.accent_color
      ? ` · accent color \`#${profile.accent_color.toString(16).padStart(6, '0')}\``
      : '';
    return {
      embeds: [{ color: profile.accent_color ?? COLOR, description: `${name} has no banner${accent}` }],
    };
  }

  const banner = (options) => rest.cdn.banner(profile.id, profile.banner, options);
  return { embeds: [card(`${name} · banner`, banner({ size: VIEW }))], components: downloads(banner, profile.banner) };
}
