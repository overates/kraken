import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function load(dir) {
  const path = join(import.meta.dirname, dir);
  const files = (await readdir(path).catch(() => [])).filter((f) => f.endsWith('.js'));
  return Promise.all(files.map(async (f) => (await import(pathToFileURL(join(path, f)))).default));
}
