import { GatewayDispatchEvents } from '@discordjs/core';
import { purge } from '../utils/purge.js';

export default {
  name: GatewayDispatchEvents.GuildDelete,
  execute({ data }) {
    if (!data.unavailable) purge(data.id);
  },
};
