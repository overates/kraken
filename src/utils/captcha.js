import { createCanvas } from '@napi-rs/canvas';
import { randomInt } from 'node:crypto';

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const W = 360;
const H = 120;

export const captchaCode = (length = 5) => Array.from({ length }, () => CHARS[randomInt(CHARS.length)]).join('');

export function renderCaptcha(code) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#101210';
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = `rgba(183, 255, 96, ${0.15 + Math.random() * 0.2})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, randomInt(H));
    ctx.bezierCurveTo(W / 3, randomInt(H), (W / 3) * 2, randomInt(H), W, randomInt(H));
    ctx.stroke();
  }

  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(235, 240, 230, ${Math.random() * 0.35})`;
    ctx.fillRect(randomInt(W), randomInt(H), 2, 2);
  }

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const step = W / (code.length + 1);

  [...code].forEach((char, i) => {
    ctx.save();
    ctx.translate(step * (i + 1), H / 2 + randomInt(-12, 13));
    ctx.rotate((randomInt(-30, 31) * Math.PI) / 180);
    ctx.font = `800 ${randomInt(46, 58)}px Inter, "Liberation Sans"`;
    ctx.fillStyle = i % 2 ? '#b7ff60' : '#f5f7f2';
    ctx.fillText(char, 0, 0);
    ctx.restore();
  });

  ctx.strokeStyle = 'rgba(16, 18, 16, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(10, randomInt(30, 90));
  ctx.bezierCurveTo(120, randomInt(H), 240, randomInt(H), W - 10, randomInt(30, 90));
  ctx.stroke();

  return canvas.encode('png');
}
