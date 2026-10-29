import { ButtonStyle, ComponentType, OverwriteType, PermissionFlagsBits } from '@discordjs/core';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { api } from '../client.js';
import { COLOR } from '../context.js';
import { db } from '../db.js';

const VIEW = PermissionFlagsBits.ViewChannel;
const READ = PermissionFlagsBits.ReadMessageHistory;
const SPEAK = PermissionFlagsBits.SendMessages | PermissionFlagsBits.AddReactions;
const TTL = 20;
const REASON = { reason: 'Verification' };

export const getVerification = (guildId) => db.prepare('SELECT * FROM Verification WHERE guildId = ?').get(guildId);

// Challenges are stateless: the answer only lives inside this signature, so nothing is stored while users solve them
export const sign = (...parts) =>
  createHmac('sha256', process.env.VERIFY_SECRET).update(parts.join('|')).digest('base64url').slice(0, 22);

export function checkSignature(signature, ...parts) {
  const expected = Buffer.from(sign(...parts));
  const given = Buffer.from(String(signature));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const expiry = () => Math.floor(Date.now() / 1000) + TTL;
export const expired = (exp) => Number(exp) < Date.now() / 1000;

export const normalize = (answer) =>
  String(answer ?? '')
    .replace(/\s+/g, '')
    .toUpperCase();

export function panel() {
  return {
    embeds: [
      {
        color: COLOR,
        description: '**Verify to access the server**\n> Click **Verify** and type the code from the image',
      },
    ],
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            custom_id: 'verification:start',
            style: ButtonStyle.Secondary,
            label: 'Verify',
          },
        ],
      },
    ],
  };
}

async function setOverwrite(channelId, id, allow, deny) {
  if (!allow && !deny) {
    await api.channels.deletePermissionOverwrite(channelId, id, REASON).catch(() => {});
    return;
  }
  await api.channels.editPermissionOverwrite(
    channelId,
    id,
    { type: OverwriteType.Role, allow: String(allow), deny: String(deny) },
    REASON,
  );
}

export async function enable(guildId, { channelId, unverifiedRoleId, roleId }) {
  await disable(guildId);

  const channel = await api.channels.get(channelId);
  const saved = [];
  const remember = (id) => {
    const o = channel.permission_overwrites?.find((x) => x.id === id);
    saved.push({ id, allow: o?.allow ?? '0', deny: o?.deny ?? '0' });
    return { allow: BigInt(o?.allow ?? 0), deny: BigInt(o?.deny ?? 0) };
  };

  const everyone = remember(guildId);
  await setOverwrite(channelId, guildId, everyone.allow & ~VIEW, everyone.deny | VIEW);

  const unverified = remember(unverifiedRoleId);
  await setOverwrite(
    channelId,
    unverifiedRoleId,
    (unverified.allow | VIEW | READ) & ~SPEAK,
    (unverified.deny & ~(VIEW | READ)) | SPEAK,
  );

  const message = await api.channels.createMessage(channelId, panel());

  db.prepare(
    `INSERT INTO Verification (guildId, method, channelId, unverifiedRoleId, roleId, messageId, overwrites)
     VALUES (?, 'captcha', ?, ?, ?, ?, ?)`,
  ).run(guildId, channelId, unverifiedRoleId, roleId, message.id, JSON.stringify(saved));
}

export async function disable(guildId) {
  const config = getVerification(guildId);
  if (!config) return false;

  db.prepare('DELETE FROM Verification WHERE guildId = ?').run(guildId);

  for (const o of JSON.parse(config.overwrites)) {
    await setOverwrite(config.channelId, o.id, BigInt(o.allow), BigInt(o.deny)).catch(() => {});
  }

  if (config.messageId) await api.channels.deleteMessage(config.channelId, config.messageId).catch(() => {});
  return true;
}

export function purgeVerification(guildId) {
  db.prepare('DELETE FROM Verification WHERE guildId = ?').run(guildId);
}
