export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Snowflake IDs carry their creation time in the top 42 bits, counted from the Discord epoch (2015)
export const createdAt = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);

export const timestamp = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;

export function fit(lines, max = 4000) {
  let out = '';

  for (const [i, line] of lines.entries()) {
    if (out.length + line.length + 1 > max) return `${out}\n… and ${lines.length - i} more`;
    out += (i ? '\n' : '') + line;
  }

  return out.trimEnd();
}
