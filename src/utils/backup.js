import { ChannelType, OverwriteType, StickerFormatType } from '@discordjs/core';
import { gunzipSync, gzipSync } from 'node:zlib';
import { api, rest } from '../client.js';
import { download } from './cdn.js';

const MAGIC = Buffer.from('KRAKEN');
const VERSION = 2;
const MAX_FILE = 10 * 1024 * 1024;
const IMAGE_BUDGET = 7 * 1024 * 1024;
const MAX_ROLES = 250;
const MAX_CHANNELS = 500;
const MAX_EMOJIS = 500;
const MAX_STICKERS = 60;
const MAX_BANS = 50_000;
const EVERYONE = 'everyone';
const REASON = { reason: 'Backup load' };

const TYPES = [
  ChannelType.GuildCategory,
  ChannelType.GuildText,
  ChannelType.GuildVoice,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
];

const FALLBACK = {
  [ChannelType.GuildAnnouncement]: ChannelType.GuildText,
  [ChannelType.GuildForum]: ChannelType.GuildText,
  [ChannelType.GuildStageVoice]: ChannelType.GuildVoice,
};

const FORUM_ONLY = ['available_tags', 'default_reaction_emoji', 'default_sort_order', 'default_forum_layout'];

const STICKER_EXT = { [StickerFormatType.PNG]: 'png', [StickerFormatType.APNG]: 'png', [StickerFormatType.GIF]: 'gif' };

const fileName = (name) =>
  `${
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^\w]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'server'
  }.kraken`;

function imageBudget() {
  let left = IMAGE_BUDGET;
  let skipped = 0;

  return {
    async get(url, maxBytes = 2 * 1024 * 1024) {
      if (!url) return null;
      const buffer = await download(url, { maxBytes });
      if (!buffer) return null;
      if (buffer.length > left) {
        skipped++;
        return null;
      }
      left -= buffer.length;
      const type = url.includes('.gif') ? 'gif' : 'png';
      return `data:image/${type};base64,${buffer.toString('base64')}`;
    },
    get skipped() {
      return skipped;
    },
  };
}

async function fetchBans(guildId) {
  const ids = [];
  let after;

  while (ids.length < MAX_BANS) {
    const page = await api.guilds.getMemberBans(guildId, { limit: 1000, ...(after && { after }) }).catch(() => null);
    if (!page?.length) break;
    ids.push(...page.map((b) => b.user.id));
    after = page.at(-1).user.id;
    if (page.length < 1000) break;
  }

  return ids.slice(0, MAX_BANS);
}

export async function createBackup(guildId) {
  const [guild, channels, emojis, stickers, automod, bans] = await Promise.all([
    api.guilds.get(guildId),
    api.guilds.getChannels(guildId),
    api.guilds.getEmojis(guildId).catch(() => []),
    api.guilds.getStickers(guildId).catch(() => []),
    api.guilds.getAutoModerationRules(guildId).catch(() => []),
    fetchBans(guildId),
  ]);
  const images = imageBudget();

  const roleList = guild.roles.filter((r) => !r.managed && r.id !== guild.id).sort((a, b) => b.position - a.position);
  const roleRefs = new Set(roleList.map((r) => r.id));

  const roles = [];
  for (const r of roleList) {
    roles.push({
      ref: r.id,
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      mentionable: r.mentionable,
      permissions: r.permissions,
      unicodeEmoji: r.unicode_emoji ?? null,
      icon: r.icon ? await images.get(rest.cdn.roleIcon(r.id, r.icon, { extension: 'png', size: 64 })) : null,
    });
  }

  const saved = channels
    .filter((c) => TYPES.includes(c.type))
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      ref: c.id,
      type: c.type,
      name: c.name,
      parent: c.parent_id ?? null,
      position: c.position,
      topic: c.topic ?? null,
      nsfw: c.nsfw ?? false,
      slowmode: c.rate_limit_per_user ?? 0,
      bitrate: c.bitrate ?? null,
      userLimit: c.user_limit ?? null,
      rtcRegion: c.rtc_region ?? null,
      videoQuality: c.video_quality_mode ?? null,
      archive: c.default_auto_archive_duration ?? null,
      threadSlowmode: c.default_thread_rate_limit_per_user ?? null,
      tags: (c.available_tags ?? []).map((t) => ({
        name: t.name,
        moderated: t.moderated,
        emojiId: t.emoji_id,
        emojiName: t.emoji_name,
      })),
      reaction: c.default_reaction_emoji
        ? { emojiId: c.default_reaction_emoji.emoji_id, emojiName: c.default_reaction_emoji.emoji_name }
        : null,
      sortOrder: c.default_sort_order ?? null,
      layout: c.default_forum_layout ?? null,
      overwrites: (c.permission_overwrites ?? [])
        .filter((o) => o.type === OverwriteType.Role && (o.id === guild.id || roleRefs.has(o.id)))
        .map((o) => ({ role: o.id === guild.id ? EVERYONE : o.id, allow: o.allow, deny: o.deny })),
    }));

  const server = {
    name: guild.name,
    description: guild.description ?? null,
    icon: guild.icon ? await images.get(rest.cdn.icon(guild.id, guild.icon, { size: 512, extension: 'png' })) : null,
    banner: guild.banner
      ? await images.get(rest.cdn.banner(guild.id, guild.banner, { size: 1024, extension: 'png' }))
      : null,
    splash: guild.splash
      ? await images.get(rest.cdn.splash(guild.id, guild.splash, { size: 1024, extension: 'png' }))
      : null,
    afkChannel: guild.afk_channel_id ?? null,
    systemChannel: guild.system_channel_id ?? null,
    systemChannelFlags: guild.system_channel_flags ?? 0,
    locale: guild.preferred_locale ?? null,
    progressBar: guild.premium_progress_bar_enabled ?? false,
    settings: {
      verification_level: guild.verification_level,
      default_message_notifications: guild.default_message_notifications,
      explicit_content_filter: guild.explicit_content_filter,
      afk_timeout: guild.afk_timeout,
    },
  };

  const savedEmojis = [];
  for (const e of emojis.slice(0, MAX_EMOJIS)) {
    const image = await images.get(
      rest.cdn.emoji(e.id, { extension: e.animated ? 'gif' : 'png', size: 128 }),
      256 * 1024,
    );
    if (image)
      savedEmojis.push({ ref: e.id, name: e.name, image, roles: (e.roles ?? []).filter((id) => roleRefs.has(id)) });
  }

  const savedStickers = [];
  for (const s of stickers.slice(0, MAX_STICKERS)) {
    const ext = STICKER_EXT[s.format_type];
    if (!ext) continue;
    const image = await images.get(rest.cdn.sticker(s.id, ext), 512 * 1024);
    if (image) savedStickers.push({ name: s.name, description: s.description ?? '', tags: s.tags ?? '', image });
  }

  const rules = automod.map((r) => ({
    name: r.name,
    eventType: r.event_type,
    triggerType: r.trigger_type,
    triggerMetadata: r.trigger_metadata ?? {},
    actions: r.actions,
    enabled: r.enabled,
    exemptRoles: r.exempt_roles.filter((id) => roleRefs.has(id)),
    exemptChannels: r.exempt_channels,
  }));

  const data = {
    version: VERSION,
    createdAt: new Date().toISOString(),
    server,
    everyone: guild.roles.find((r) => r.id === guild.id)?.permissions ?? '0',
    roles,
    channels: saved,
    emojis: savedEmojis,
    stickers: savedStickers,
    automod: rules,
    bans,
  };

  const file = Buffer.concat([MAGIC, Buffer.from([VERSION]), gzipSync(JSON.stringify(data))]);

  return {
    name: fileName(guild.name),
    data: file,
    stats: {
      roles: roles.length,
      channels: saved.length,
      emojis: savedEmojis.length,
      stickers: savedStickers.length,
      automod: rules.length,
      bans: bans.length,
      skipped: images.skipped,
    },
  };
}

const isString = (v, max) => typeof v === 'string' && v.length <= max;
const isOptionalString = (v, max) => v == null || isString(v, max);
const isBits = (v) => typeof v === 'string' && /^\d{1,20}$/.test(v);
const isId = (v) => typeof v === 'string' && /^\d{1,20}$/.test(v);
const isImage = (v, max = 3 * 1024 * 1024) =>
  v == null || (isString(v, max) && /^data:image\/(png|gif);base64,[A-Za-z0-9+/]+=*$/.test(v));

function validate(data) {
  if (data?.version !== VERSION || typeof data.server !== 'object' || data.server === null) return false;

  const { server } = data;
  const lists = [
    [data.roles, MAX_ROLES],
    [data.channels, MAX_CHANNELS],
    [data.emojis, MAX_EMOJIS],
    [data.stickers, MAX_STICKERS],
    [data.automod, 10],
    [data.bans, MAX_BANS],
  ];
  if (!lists.every(([list, max]) => Array.isArray(list) && list.length <= max)) return false;

  return (
    isString(server.name, 100) &&
    isOptionalString(server.description, 300) &&
    isImage(server.icon) &&
    isImage(server.banner) &&
    isImage(server.splash) &&
    isBits(data.everyone) &&
    data.roles.every(
      (r) =>
        isId(r.ref) &&
        isString(r.name, 100) &&
        Number.isInteger(r.color) &&
        isBits(r.permissions) &&
        isOptionalString(r.unicodeEmoji, 32) &&
        isImage(r.icon, 512 * 1024),
    ) &&
    data.channels.every(
      (c) =>
        isId(c.ref) &&
        isString(c.name, 100) &&
        TYPES.includes(c.type) &&
        isOptionalString(c.topic, 4096) &&
        Array.isArray(c.overwrites) &&
        c.overwrites.every((o) => isString(o.role, 20) && isBits(o.allow) && isBits(o.deny)) &&
        Array.isArray(c.tags) &&
        c.tags.length <= 20 &&
        c.tags.every((t) => isString(t.name, 20)),
    ) &&
    data.emojis.every((e) => isId(e.ref) && /^\w{2,32}$/.test(e.name) && isImage(e.image, 512 * 1024)) &&
    data.stickers.every(
      (s) =>
        isString(s.name, 30) && isString(s.description, 100) && isString(s.tags, 200) && isImage(s.image, 1024 * 1024),
    ) &&
    data.automod.every((r) => isString(r.name, 100) && Number.isInteger(r.triggerType) && Array.isArray(r.actions)) &&
    data.bans.every(isId)
  );
}

// Backups come from users, so cap the decompressed size and validate every field before touching the server
function readBackup(buffer) {
  if (buffer.length > MAX_FILE || !buffer.subarray(0, MAGIC.length).equals(MAGIC)) return null;
  if (buffer[MAGIC.length] !== VERSION) return null;

  try {
    const json = gunzipSync(buffer.subarray(MAGIC.length + 1), { maxOutputLength: 2 * MAX_FILE });
    const data = JSON.parse(json.toString());
    return validate(data) ? data : null;
  } catch {
    return null;
  }
}

export async function downloadBackup(attachment) {
  if (!attachment || attachment.size > MAX_FILE) return null;

  const buffer = await download(attachment.url, { maxBytes: MAX_FILE, timeout: 20_000 });
  return buffer && readBackup(buffer);
}

const toBuffer = (dataUri) => Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64');

async function createChannel(guildId, body) {
  try {
    return await api.guilds.createChannel(guildId, body, REASON);
  } catch (error) {
    if (!(body.type in FALLBACK)) throw error;
    const plain = Object.fromEntries(Object.entries(body).filter(([key]) => !FORUM_ONLY.includes(key)));
    return api.guilds.createChannel(guildId, { ...plain, type: FALLBACK[body.type] }, REASON);
  }
}

export async function loadBackup(guildId, data, bot) {
  const stats = { roles: 0, channels: 0, emojis: 0, stickers: 0, automod: 0, bans: 0, failed: 0 };
  const attempt = async (fn) => {
    try {
      return await fn();
    } catch {
      stats.failed++;
      return null;
    }
  };
  const quiet = (promise) => promise.catch(() => {});

  const [guild, channels, emojis, stickers, automod] = await Promise.all([
    api.guilds.get(guildId),
    api.guilds.getChannels(guildId),
    api.guilds.getEmojis(guildId).catch(() => []),
    api.guilds.getStickers(guildId).catch(() => []),
    api.guilds.getAutoModerationRules(guildId).catch(() => []),
  ]);

  for (const channel of channels) await quiet(api.channels.delete(channel.id, REASON));
  for (const role of guild.roles) {
    if (role.managed || role.id === guildId || role.position >= bot.highest) continue;
    await quiet(api.guilds.deleteRole(guildId, role.id, REASON));
  }
  for (const emoji of emojis) await quiet(api.guilds.deleteEmoji(guildId, emoji.id, REASON));
  for (const sticker of stickers) await quiet(api.guilds.deleteSticker(guildId, sticker.id, REASON));
  for (const rule of automod) await quiet(api.guilds.deleteAutoModerationRule(guildId, rule.id, REASON));

  await attempt(() => api.guilds.editRole(guildId, guildId, { permissions: data.everyone }, REASON));

  const roleIds = new Map([[EVERYONE, guildId]]);
  for (const role of data.roles) {
    const body = {
      name: role.name,
      color: role.color,
      hoist: Boolean(role.hoist),
      mentionable: Boolean(role.mentionable),
      permissions: role.permissions,
    };
    const extras = {
      ...(role.icon && { icon: role.icon }),
      ...(role.unicodeEmoji && { unicode_emoji: role.unicodeEmoji }),
    };

    let created = Object.keys(extras).length
      ? await api.guilds.createRole(guildId, { ...body, ...extras }, REASON).catch(() => null)
      : null;
    created ??= await attempt(() => api.guilds.createRole(guildId, body, REASON));

    if (created) {
      roleIds.set(role.ref, created.id);
      stats.roles++;
    }
  }

  const emojiIds = new Map();
  for (const emoji of data.emojis) {
    const created = await attempt(() =>
      api.guilds.createEmoji(
        guildId,
        { name: emoji.name, image: emoji.image, roles: (emoji.roles ?? []).map((r) => roleIds.get(r)).filter(Boolean) },
        REASON,
      ),
    );
    if (created) {
      emojiIds.set(emoji.ref, created.id);
      stats.emojis++;
    }
  }

  const emojiRef = (id, name) => ({
    emoji_id: id ? (emojiIds.get(id) ?? null) : null,
    emoji_name: id ? null : (name ?? null),
  });

  const channelIds = new Map();
  const ordered = [
    ...data.channels.filter((c) => c.type === ChannelType.GuildCategory),
    ...data.channels.filter((c) => c.type !== ChannelType.GuildCategory),
  ];

  for (const channel of ordered) {
    const forum = channel.type === ChannelType.GuildForum;
    const body = {
      name: channel.name,
      type: channel.type,
      parent_id: channelIds.get(channel.parent) ?? undefined,
      permission_overwrites: channel.overwrites
        .filter((o) => roleIds.has(o.role))
        .map((o) => ({ id: roleIds.get(o.role), type: OverwriteType.Role, allow: o.allow, deny: o.deny })),
      ...(channel.topic && { topic: String(channel.topic).slice(0, 4096) }),
      ...(channel.nsfw && { nsfw: true }),
      ...(channel.slowmode && { rate_limit_per_user: channel.slowmode }),
      ...(channel.bitrate && { bitrate: Math.min(channel.bitrate, 96_000) }),
      ...(channel.userLimit && { user_limit: channel.userLimit }),
      ...(channel.rtcRegion && { rtc_region: channel.rtcRegion }),
      ...(channel.videoQuality && { video_quality_mode: channel.videoQuality }),
      ...(channel.archive && { default_auto_archive_duration: channel.archive }),
      ...(channel.threadSlowmode && { default_thread_rate_limit_per_user: channel.threadSlowmode }),
      ...(forum && {
        available_tags: channel.tags.map((t) => ({
          name: t.name,
          moderated: Boolean(t.moderated),
          ...emojiRef(t.emojiId, t.emojiName),
        })),
        ...(channel.reaction && {
          default_reaction_emoji: emojiRef(channel.reaction.emojiId, channel.reaction.emojiName),
        }),
        ...(channel.sortOrder != null && { default_sort_order: channel.sortOrder }),
        ...(channel.layout != null && { default_forum_layout: channel.layout }),
      }),
    };

    const created = await attempt(() => createChannel(guildId, body));
    if (created) {
      channelIds.set(channel.ref, created.id);
      stats.channels++;
    }
  }

  const positions = data.channels
    .filter((c) => channelIds.has(c.ref) && Number.isInteger(c.position))
    .map((c) => ({ id: channelIds.get(c.ref), position: c.position }));
  if (positions.length) await attempt(() => api.guilds.setChannelPositions(guildId, positions, REASON));

  for (const sticker of data.stickers) {
    const ext = sticker.image.startsWith('data:image/gif') ? 'gif' : 'png';
    const created = await attempt(() =>
      api.guilds.createSticker(
        guildId,
        {
          name: sticker.name,
          description: sticker.description,
          tags: sticker.tags || sticker.name,
          file: { name: `sticker.${ext}`, data: toBuffer(sticker.image), contentType: `image/${ext}` },
        },
        REASON,
      ),
    );
    if (created) stats.stickers++;
  }

  for (const rule of data.automod) {
    const actions = rule.actions
      .map((a) =>
        a.metadata?.channel_id
          ? channelIds.has(a.metadata.channel_id)
            ? { ...a, metadata: { ...a.metadata, channel_id: channelIds.get(a.metadata.channel_id) } }
            : null
          : a,
      )
      .filter(Boolean);
    if (!actions.length) continue;

    const created = await attempt(() =>
      api.guilds.createAutoModerationRule(
        guildId,
        {
          name: rule.name,
          event_type: rule.eventType,
          trigger_type: rule.triggerType,
          trigger_metadata: rule.triggerMetadata,
          actions,
          enabled: Boolean(rule.enabled),
          exempt_roles: rule.exemptRoles.map((r) => roleIds.get(r)).filter(Boolean),
          exempt_channels: (rule.exemptChannels ?? []).map((c) => channelIds.get(c)).filter(Boolean),
        },
        REASON,
      ),
    );
    if (created) stats.automod++;
  }

  const { server } = data;
  await attempt(() =>
    api.guilds.edit(
      guildId,
      {
        name: server.name,
        ...server.settings,
        afk_channel_id: channelIds.get(server.afkChannel) ?? null,
        system_channel_id: channelIds.get(server.systemChannel) ?? null,
        system_channel_flags: server.systemChannelFlags,
        ...(server.locale && { preferred_locale: server.locale }),
        premium_progress_bar_enabled: Boolean(server.progressBar),
      },
      REASON,
    ),
  );
  for (const key of ['icon', 'banner', 'splash']) {
    if (server[key]) await attempt(() => api.guilds.edit(guildId, { [key]: server[key] }, REASON));
  }
  if (server.description) await quiet(api.guilds.edit(guildId, { description: server.description }, REASON));

  for (let i = 0; i < data.bans.length; i += 200) {
    const result = await attempt(() =>
      api.guilds.bulkBanUsers(guildId, { user_ids: data.bans.slice(i, i + 200), delete_message_seconds: 0 }, REASON),
    );
    stats.bans += result?.banned_users?.length ?? 0;
  }

  return stats;
}
