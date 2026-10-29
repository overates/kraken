import { GatewayDispatchEvents } from '@discordjs/core';
import { enqueue } from '../utils/autorole.js';
import { enforce } from '../utils/gate.js';
import { guardJoin } from '../utils/shield.js';

export default {
  name: GatewayDispatchEvents.GuildMemberAdd,
  async execute({ data }) {
    if (await guardJoin(data.guild_id, data.user)) return;
    if (await enforce(data.guild_id, data.user)) return;

    enqueue(data.guild_id, data.user.id);
  },
};
