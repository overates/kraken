import { RESTJSONErrorCodes } from '@discordjs/core';
import { setTimeout as sleep } from 'node:timers/promises';
import { api } from '../client.js';
import { db } from '../db.js';

// Small joins get their role right away, raids are drained slowly to stay under rate limits
const BURST = 3;
const DELAY = 1_000;

const queues = new Map();

export const autoroles = {
  get(guildId) {
    return db.prepare('SELECT autoroleId FROM Guild WHERE id = ?').get(guildId)?.autoroleId ?? null;
  },

  set(guildId, autoroleId) {
    db.prepare(
      'INSERT INTO Guild (id, autoroleId) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET autoroleId = excluded.autoroleId',
    ).run(guildId, autoroleId);
  },

  clear(guildId) {
    db.prepare('DELETE FROM Guild WHERE id = ?').run(guildId);
    queues.get(guildId)?.splice(0);
  },
};

export function enqueue(guildId, userId) {
  const queue = queues.get(guildId);
  if (queue) return void queue.push(userId);

  queues.set(guildId, [userId]);
  drain(guildId);
}

async function drain(guildId) {
  const queue = queues.get(guildId);

  try {
    while (queue.length) {
      const roleId = autoroles.get(guildId);
      if (!roleId) break;

      const userId = queue.shift();

      try {
        await api.guilds.addRoleToMember(guildId, userId, roleId, { reason: 'Autorole' });
      } catch (error) {
        if (error.code === RESTJSONErrorCodes.UnknownRole) {
          autoroles.clear(guildId);
          break;
        }
        if (error.code !== RESTJSONErrorCodes.UnknownMember) console.error(error);
      }

      if (queue.length >= BURST) await sleep(DELAY);
    }
  } catch (error) {
    console.error(error);
  } finally {
    queues.delete(guildId);
  }
}
