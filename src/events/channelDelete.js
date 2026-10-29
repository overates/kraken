import { GatewayDispatchEvents } from '@discordjs/core';
import { db } from '../db.js';
import { purgeGiveaways } from '../utils/giveaway.js';
import { disable, getVerification } from '../utils/verification.js';

export default {
  name: GatewayDispatchEvents.ChannelDelete,
  async execute({ data }) {
    if (!data.guild_id) return;

    db.prepare('DELETE FROM Lock WHERE channelId = ?').run(data.id);
    purgeGiveaways({ channelId: data.id });

    const verification = getVerification(data.guild_id);
    if (verification?.channelId === data.id) await disable(data.guild_id);
  },
};
