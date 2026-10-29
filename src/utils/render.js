import { createCanvas, loadImage } from '@napi-rs/canvas';
import { download } from './cdn.js';

const FONT = '"Liberation Sans", "Noto Color Emoji", "WenQuanYi Zen Hei"';
const WIDTH = 800;
const PAD = 20;
const AVATAR = 40;
const TEXT_X = PAD + AVATAR + 16;
const TEXT_W = WIDTH - TEXT_X - PAD;
const LINE = 22;
const MAX_LINES = 30;
const IMAGE = { w: 400, h: 300 };

const COLORS = { bg: '#313338', name: '#f2f3f5', time: '#949ba4', text: '#dbdee1' };

// Turns raw mention and emoji markup into what a user would actually see in the client
export function plainContent(content, mentions = {}) {
  return content
    .replace(/<@!?(\d+)>/g, (_, id) => `@${mentions[id] ?? 'unknown'}`)
    .replace(/<@&\d+>/g, '@role')
    .replace(/<#\d+>/g, '#channel')
    .replace(/<a?:(\w+):\d+>/g, ':$1:')
    .replace(/<t:(\d+)(?::\w)?>/g, (_, s) => new Date(s * 1000).toUTCString());
}

function wrap(ctx, text) {
  const lines = [];

  for (const paragraph of text.split('\n')) {
    let line = '';

    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= TEXT_W) {
        line = next;
        continue;
      }
      if (line) lines.push(line);

      line = '';
      for (const char of word) {
        if (ctx.measureText(line + char).width > TEXT_W) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    lines.push(line);
  }

  if (lines.length > MAX_LINES) return [...lines.slice(0, MAX_LINES - 1), '…'];
  return lines;
}

const formatTime = (iso) => {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
};

async function fetchImage(url) {
  const buffer = await download(url, { timeout: 5_000 });
  return buffer && loadImage(buffer).catch(() => null);
}

export async function renderMessage({ author, avatarUrl, content, timestamp, mentions }, image) {
  const measure = createCanvas(1, 1).getContext('2d');
  measure.font = `16px ${FONT}`;
  const text = plainContent(content ?? '', mentions);
  const lines = text ? wrap(measure, text) : [];

  const [avatar, attachment] = await Promise.all([
    fetchImage(avatarUrl),
    image ? loadImage(image).catch(() => null) : null,
  ]);

  const scale = attachment ? Math.min(1, IMAGE.w / attachment.width, IMAGE.h / attachment.height) : 0;
  const imageH = attachment ? Math.round(attachment.height * scale) : 0;
  const height = PAD + 24 + lines.length * LINE + (attachment ? 8 + imageH : 0) + PAD;

  measure.font = `bold 16px ${FONT}`;
  const header = measure.measureText(author.username).width + 150;
  measure.font = `16px ${FONT}`;
  const contentWidth = Math.max(
    header,
    ...lines.map((l) => measure.measureText(l).width),
    attachment ? attachment.width * scale : 0,
  );
  const width = Math.min(WIDTH, Math.ceil(TEXT_X + contentWidth + PAD + 20));

  const canvas = createCanvas(Math.max(width, 360), Math.max(height, PAD * 2 + AVATAR));
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.beginPath();
  ctx.arc(PAD + AVATAR / 2, PAD + AVATAR / 2, AVATAR / 2, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, PAD, PAD, AVATAR, AVATAR);
  else {
    ctx.fillStyle = '#5865f2';
    ctx.fillRect(PAD, PAD, AVATAR, AVATAR);
  }
  ctx.restore();

  ctx.textBaseline = 'top';
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillStyle = COLORS.name;
  ctx.fillText(author.username, TEXT_X, PAD + 2);

  const nameWidth = ctx.measureText(author.username).width;
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = COLORS.time;
  ctx.fillText(formatTime(timestamp), TEXT_X + nameWidth + 8, PAD + 5);

  ctx.font = `16px ${FONT}`;
  ctx.fillStyle = COLORS.text;
  lines.forEach((line, i) => ctx.fillText(line, TEXT_X, PAD + 26 + i * LINE));

  if (attachment) {
    const y = PAD + 26 + lines.length * LINE + 8;
    const w = Math.round(attachment.width * scale);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(TEXT_X, y, w, imageH, 8);
    ctx.clip();
    ctx.drawImage(attachment, TEXT_X, y, w, imageH);
    ctx.restore();
  }

  return canvas.encode('png');
}
