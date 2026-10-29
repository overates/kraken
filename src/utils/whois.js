import { api, rest } from '../client.js';
import { COLOR } from '../context.js';
import { avatarUrl } from './cdn.js';
import { getFlags } from './flags.js';
import { createdAt } from './format.js';
import { renderWhois } from './whoisCard.js';

const FLAGGED_COLOR = 0xff5c5c;

export async function whoisCard(user) {
  const [profile, flags] = await Promise.all([api.users.get(user.id).catch(() => user), getFlags(user.id)]);

  const data = await renderWhois({
    username: profile.username,
    id: profile.id,
    avatarUrl: avatarUrl(profile),
    bannerUrl: profile.banner && rest.cdn.banner(profile.id, profile.banner, { size: 1024, extension: 'png' }),
    created: createdAt(profile.id),
    flags,
  });

  return {
    profile,
    flags,
    color: flags.length ? FLAGGED_COLOR : COLOR,
    file: { name: 'whois.png', data, contentType: 'image/png' },
  };
}

export async function replyWhois(ctx, user) {
  await ctx.defer();

  const { color, file } = await whoisCard(user);

  await ctx.editMessage({ embeds: [{ color, image: { url: 'attachment://whois.png' } }], files: [file] });
}
