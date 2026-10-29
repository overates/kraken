import { load } from './loader.js';

export const [publicCommands, ownerCommands] = await Promise.all([load('commands'), load('commands/owner')]);

export const commands = new Map([
  ...publicCommands.map((command) => [command.data.name, command]),
  ...ownerCommands.map((command) => [command.data.name, { ...command, owner: true }]),
]);
