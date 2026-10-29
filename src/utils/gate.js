import { api } from '../client.js';
import { db } from '../db.js';
import { createdAt, plural } from './format.js';

const DAY = 86_400_000;

const toGate = (row) => row && { ...row, avatar: Boolean(row.avatar) };

export const getGate = (guildId) => toGate(db.prepare('SELECT * FROM Gate WHERE guildId = ?').get(guildId));

export function setGate(guildId, { minAge, avatar, action }) {
  if (!minAge && !avatar) {
    clearGate(guildId);
    return null;
  }

  const row = db
    .prepare(
      `INSERT INTO Gate (guildId, minAge, avatar, action) VALUES (?, ?, ?, ?)
       ON CONFLICT (guildId) DO UPDATE SET minAge = excluded.minAge, avatar = excluded.avatar, action = excluded.action
       RETURNING *`,
    )
    .get(guildId, minAge, avatar ? 1 : 0, action);
  return toGate(row);
}

export function clearGate(guildId) {
  db.prepare('DELETE FROM Gate WHERE guildId = ?').run(guildId);
}

export function describe(gate) {
  if (!gate) return 'Gate is off';

  return [
    `Account age · ${gate.minAge ? `${plural(gate.minAge, 'day')} minimum` : 'any'}`,
    `Avatar · ${gate.avatar ? 'required' : 'not required'}`,
    `Action · ${gate.action}`,
  ].join('\n');
}

export async function enforce(guildId, user) {
  if (user.bot) return false;

  const gate = getGate(guildId);
  if (!gate) return false;

  const reasons = [];
  if (gate.minAge && Date.now() - createdAt(user.id) < gate.minAge * DAY) {
    reasons.push(`account younger than ${plural(gate.minAge, 'day')}`);
  }
  if (gate.avatar && !user.avatar) reasons.push('no avatar');

  if (!reasons.length) return false;

  const reason = { reason: `Gate: ${reasons.join(', ')}` };

  try {
    if (gate.action === 'kick') await api.guilds.removeMember(guildId, user.id, reason);
    else await api.guilds.banUser(guildId, user.id, {}, reason);
  } catch (error) {
    console.error(error);
  }

  return true;
}
