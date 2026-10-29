import { db } from '../db.js';
import { autoroles } from './autorole.js';
import { clearGate } from './gate.js';
import { purgeGiveaways } from './giveaway.js';
import { purgeShield } from './shield.js';
import { purgeVerification } from './verification.js';

const SIMPLE_TABLES = ['Lock', 'BanLimit', 'BanCount', 'Freeze', 'FrozenPermission', 'AntiBot'];
const GUILD_TABLES = [...SIMPLE_TABLES, 'Gate', 'Giveaway', 'Shield', 'Verification'];

export function purge(guildId) {
  autoroles.clear(guildId);
  clearGate(guildId);
  purgeGiveaways({ guildId });
  purgeShield(guildId);
  purgeVerification(guildId);
  for (const table of SIMPLE_TABLES) db.prepare(`DELETE FROM ${table} WHERE guildId = ?`).run(guildId);
}

export function storedGuilds() {
  const query = [
    'SELECT id AS guildId FROM Guild',
    ...GUILD_TABLES.map((table) => `SELECT guildId FROM ${table}`),
  ].join(' UNION ');

  return new Set(
    db
      .prepare(query)
      .all()
      .map((row) => row.guildId),
  );
}

export function pruneCounters() {
  const day = new Date().toISOString().slice(0, 10);
  db.prepare('DELETE FROM BanCount WHERE day != ?').run(day);
  db.prepare('DELETE FROM ReportCount WHERE day != ?').run(day);
}
