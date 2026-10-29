import { rest } from '../client.js';

const HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

function isDiscordCdn(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && HOSTS.has(hostname);
  } catch {
    return false;
  }
}

export async function download(url, { maxBytes = 10 * 1024 * 1024, timeout = 10_000 } = {}) {
  if (!isDiscordCdn(url)) return null;

  try {
    const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(timeout) });
    if (!res.ok || Number(res.headers.get('content-length') ?? 0) > maxBytes) return null;

    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > maxBytes) return null;
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

export function avatarUrl(user, size = 256) {
  if (!user.avatar) return rest.cdn.defaultAvatar(Number((BigInt(user.id) >> 22n) % 6n));
  return rest.cdn.avatar(user.id, user.avatar, { size });
}
