import { API } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { ownerCommands, publicCommands } from './registry.js';

const { TOKEN, CLIENT_ID, OWNER_GUILD_ID } = process.env;
const api = new API(new REST().setToken(TOKEN));
const json = (list) => list.map((c) => c.data.toJSON());

const global = await api.applicationCommands.bulkOverwriteGlobalCommands(CLIENT_ID, json(publicCommands));
const owner = await api.applicationCommands.bulkOverwriteGuildCommands(CLIENT_ID, OWNER_GUILD_ID, json(ownerCommands));

console.log(`Deployed ${global.length} global and ${owner.length} owner commands`);
