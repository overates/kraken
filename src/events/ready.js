import { GatewayDispatchEvents } from '@discordjs/core';
import { gateway } from '../client.js';
import { startScheduler } from '../utils/giveaway.js';
import { pruneCounters, purge, storedGuilds } from '../utils/purge.js';

const shardOf = (guildId, count) => Number((BigInt(guildId) >> 22n) % BigInt(count));

export default {
  name: GatewayDispatchEvents.Ready,
  async execute({ data, shardId }) {
    console.log(`Shard ${shardId} ready as ${data.user.username}`);

    if (shardId === 0) {
      startScheduler();
      pruneCounters();
    }

    const count = await gateway.getShardCount();
    const current = new Set(data.guilds.map((g) => g.id));
    const stale = [...storedGuilds()].filter((id) => shardOf(id, count) === shardId && !current.has(id));

    for (const id of stale) purge(id);
    if (stale.length) console.log(`Shard ${shardId} purged ${stale.length} old guilds`);
  },
};
