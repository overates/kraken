import { GlobalFonts, createCanvas, loadImage } from '@napi-rs/canvas';
import { readdirSync } from 'node:fs';
import { download } from './cdn.js';
import { categoryOf, emojiUrl } from './flags.js';

const ASSETS = new URL('../../assets/', import.meta.url);

for (const file of readdirSync(new URL('fonts/', ASSETS)).filter((f) => f.endsWith('.ttf'))) {
  GlobalFonts.registerFromPath(new URL(`fonts/${file}`, ASSETS).pathname, 'Inter');
}

const FONT = 'Inter, "Noto Color Emoji", "WenQuanYi Zen Hei"';
const W = 1200;
const H = 600;
const DAY = 86_400_000;

const CARD = { x: 32, y: 32, w: 1136, h: 536, r: 32 };
const BANNER_H = 200;
const AVATAR = { x: 170, y: CARD.y + BANNER_H, r: 86 };
const MAX_ROWS = 4;

const SURFACE = '#101210';
const TEXT = '#f5f7f2';
const MUTED = 'rgba(235, 240, 230, 0.5)';
const FAINT = 'rgba(235, 240, 230, 0.42)';

const STATUS = {
  clean: { label: 'CLEAN', color: '#b7ff60', stops: ['#b7ff60', '#3f8a1f', '#10290b'], background: 'whois-green.png' },
  flagged: {
    label: 'FLAGGED',
    color: '#ff5c5c',
    stops: ['#ff6b6b', '#8a2433', '#2a0d12'],
    background: 'whois-red.png',
  },
};

const RISK = [
  ['Low', '#b7ff60'],
  ['Medium', '#ffd166'],
  ['High', '#ff8f5a'],
  ['Critical', '#ff5c5c'],
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatDate = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const riskOf = (flags, created) =>
  RISK[Math.min(RISK.length - 1, Math.min(flags.length, 3) + (Date.now() - created < 30 * DAY ? 1 : 0))];

const backgrounds = new Map();
const emojis = new Map();

async function fetchImage(url) {
  const buffer = url && (await download(url, { timeout: 5_000 }));
  return buffer ? loadImage(buffer).catch(() => null) : null;
}

async function fitBackground(file) {
  const image = await loadImage(new URL(file, ASSETS).pathname);
  if (image.width <= W && image.height <= H) return image;

  const canvas = createCanvas(W, H);
  canvas.getContext('2d').drawImage(image, 0, 0, W, H);
  return loadImage(await canvas.encode('png'));
}

function loadBackground(file) {
  if (!backgrounds.has(file)) {
    backgrounds.set(
      file,
      fitBackground(file).catch((error) => {
        backgrounds.delete(file);
        throw error;
      }),
    );
  }
  return backgrounds.get(file);
}

async function loadEmoji(category) {
  if (!category) return null;
  if (!emojis.has(category.id)) {
    const image = await fetchImage(emojiUrl(category));
    if (!image) return null;
    emojis.set(category.id, image);
  }
  return emojis.get(category.id);
}

function font(ctx, weight, size, spacing = 0) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.letterSpacing = `${spacing}px`;
}

function box(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  while (text && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text}…`;
}

function shrink(ctx, text, size, min, maxWidth) {
  for (; size > min; size -= 2) {
    font(ctx, 800, size, -1.2);
    if (ctx.measureText(text).width <= maxWidth) return;
  }
  font(ctx, 800, min, -1.2);
}

function drawCard(ctx) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 16;
  box(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r, SURFACE);
  ctx.restore();
}

function drawBanner(ctx, banner, status) {
  const { x, y, w } = CARD;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, CARD.h, CARD.r);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(x, y, w, BANNER_H);
  ctx.clip();

  if (banner) {
    const scale = Math.max(w / banner.width, BANNER_H / banner.height);
    const bw = banner.width * scale;
    const bh = banner.height * scale;
    ctx.drawImage(banner, x + (w - bw) / 2, y + (BANNER_H - bh) / 2, bw, bh);
  } else {
    const gradient = ctx.createLinearGradient(x, y, x + w, y + BANNER_H);
    status.stops.forEach((color, i) => gradient.addColorStop(i / (status.stops.length - 1), color));
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, BANNER_H);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 14;
    for (let i = x - BANNER_H; i < x + w + BANNER_H; i += 44) {
      ctx.beginPath();
      ctx.moveTo(i, y + BANNER_H);
      ctx.lineTo(i + BANNER_H, y);
      ctx.stroke();
    }
  }

  const fade = ctx.createLinearGradient(0, y + BANNER_H - 90, 0, y + BANNER_H);
  fade.addColorStop(0, 'rgba(16, 18, 16, 0)');
  fade.addColorStop(1, 'rgba(16, 18, 16, 0.45)');
  ctx.fillStyle = fade;
  ctx.fillRect(x, y + BANNER_H - 90, w, 90);
  ctx.restore();
}

function drawStatus(ctx, status) {
  font(ctx, 700, 15, 3);
  const width = 20 + ctx.measureText(status.label).width + 36;
  const x = CARD.x + CARD.w - 44 - width;
  const y = CARD.y + 28;

  box(ctx, x, y, width, 40, 20, 'rgba(0, 0, 0, 0.5)', 'rgba(255, 255, 255, 0.16)');

  ctx.save();
  ctx.shadowColor = status.color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x + 23, y + 20, 5, 0, Math.PI * 2);
  ctx.fillStyle = status.color;
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = status.color;
  ctx.fillText(status.label, x + 38, y + 21);
}

function drawAvatar(ctx, avatar) {
  const { x, y, r } = AVATAR;

  ctx.beginPath();
  ctx.arc(x, y, r + 10, 0, Math.PI * 2);
  ctx.fillStyle = SURFACE;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, x - r, y - r, r * 2, r * 2);
  else {
    ctx.fillStyle = '#1c1f1a';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}

function drawIdentity(ctx, { username, id, created, flags }) {
  const x = CARD.x + 44;
  const [risk, color] = riskOf(flags, created);

  ctx.textAlign = 'left';
  shrink(ctx, username, 46, 28, 440);
  ctx.fillStyle = TEXT;
  ctx.fillText(username, x, 380);

  font(ctx, 500, 19);
  ctx.fillStyle = MUTED;
  ctx.fillText(id, x, 422);

  font(ctx, 500, 17);
  ctx.fillStyle = FAINT;
  ctx.fillText(`Joined Discord ${formatDate(created)}`, x, 456);

  font(ctx, 700, 17);
  const chip = 92 + ctx.measureText(risk).width;
  box(ctx, x, 486, chip, 40, 12, 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.08)');
  font(ctx, 600, 12, 2);
  ctx.fillStyle = FAINT;
  ctx.fillText('RISK', x + 16, 507);
  font(ctx, 700, 17);
  ctx.fillStyle = color;
  ctx.fillText(risk, x + 64, 507);
}

function drawRecords(ctx, flags, icons) {
  const x = 600;
  const width = CARD.x + CARD.w - 48 - x;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillRect(560, 272, 1, 260);

  ctx.textAlign = 'left';
  font(ctx, 600, 12, 2.5);
  ctx.fillStyle = FAINT;
  ctx.fillText(`RECORDS · ${flags.length}`, x, 284);

  if (!flags.length) {
    font(ctx, 600, 24);
    ctx.fillStyle = TEXT;
    ctx.fillText('Clean history', x, 400);
    font(ctx, 500, 17);
    ctx.fillStyle = FAINT;
    ctx.fillText('No records found for this user', x, 432);
    return;
  }

  if (flags.length > MAX_ROWS) {
    ctx.textAlign = 'right';
    font(ctx, 500, 14);
    ctx.fillStyle = FAINT;
    ctx.fillText(`latest ${MAX_ROWS} shown`, x + width, 284);
  }

  flags.slice(0, MAX_ROWS).forEach((flag, i) => {
    const y = 308 + i * 58;
    const mid = y + 24;
    box(ctx, x, y, width, 48, 14, 'rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.06)');

    if (icons[i]) ctx.drawImage(icons[i], x + 14, mid - 13, 26, 26);
    else {
      ctx.beginPath();
      ctx.arc(x + 27, mid, 6, 0, Math.PI * 2);
      ctx.fillStyle = STATUS.flagged.color;
      ctx.fill();
    }

    const date = formatDate(flag.createdAt.getTime());
    ctx.textAlign = 'right';
    font(ctx, 500, 15);
    ctx.fillStyle = FAINT;
    ctx.fillText(date, x + width - 18, mid + 1);
    const dateWidth = ctx.measureText(date).width;

    ctx.textAlign = 'left';
    font(ctx, 700, 19, 0.3);
    ctx.fillStyle = TEXT;
    ctx.fillText(fit(ctx, flag.reason, width - 54 - dateWidth - 36), x + 54, mid + 1);
  });
}

export async function renderWhois({ username, id, avatarUrl, bannerUrl, created, flags }) {
  const status = flags.length ? STATUS.flagged : STATUS.clean;
  const [image, avatar, banner, icons] = await Promise.all([
    loadBackground(status.background),
    fetchImage(avatarUrl),
    fetchImage(bannerUrl),
    Promise.all(flags.slice(0, MAX_ROWS).map((f) => loadEmoji(categoryOf(f.reason)))),
  ]);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, W, H);
  ctx.textBaseline = 'middle';

  drawCard(ctx);
  drawBanner(ctx, banner, status);
  ctx.beginPath();
  ctx.roundRect(CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  drawStatus(ctx, status);
  drawAvatar(ctx, avatar);
  drawIdentity(ctx, { username, id, created, flags });
  drawRecords(ctx, flags, icons);

  return canvas.encode('png');
}
