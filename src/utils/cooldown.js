const active = new Map();

export function remaining(key) {
  const until = active.get(key);
  return until ? Math.ceil((until - Date.now()) / 1000) : 0;
}

export function start(key, seconds) {
  active.set(key, Date.now() + seconds * 1000);
  setTimeout(() => active.delete(key), seconds * 1000).unref();
}

export function cooldown(key, seconds) {
  const wait = remaining(key);
  if (!wait) start(key, seconds);
  return wait;
}
