import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const path = process.env.DATABASE_PATH ?? 'data/kraken.db';
mkdirSync(dirname(path), { recursive: true });

export const db = new Database(path);
db.pragma('journal_mode = WAL');
db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));

export const now = () => new Date().toISOString();
