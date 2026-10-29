import { Client, GatewayIntentBits } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { WebSocketManager } from '@discordjs/ws';

export const rest = new REST().setToken(process.env.TOKEN);

export const gateway = new WebSocketManager({
  token: process.env.TOKEN,
  intents: GatewayIntentBits.Guilds | GatewayIntentBits.GuildMembers | GatewayIntentBits.GuildModeration,
  rest,
});

export const client = new Client({ rest, gateway });

export const { api } = client;
