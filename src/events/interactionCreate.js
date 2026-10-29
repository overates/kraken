import { ApplicationCommandType, GatewayDispatchEvents, InteractionType } from '@discordjs/core';
import { createContext } from '../context.js';
import { commands } from '../registry.js';
import { cooldown } from '../utils/cooldown.js';

const COMMAND_TYPES = new Set([
  ApplicationCommandType.ChatInput,
  ApplicationCommandType.User,
  ApplicationCommandType.Message,
]);

const isOwner = (ctx) => ctx.userId === process.env.OWNER_ID;

async function run(ctx, command, handler) {
  if (command.owner && !isOwner(ctx)) return ctx.reply('This command is not available', true);

  try {
    await handler();
  } catch (error) {
    console.error(error);
    const respond = ctx.responded ? ctx.followUp : ctx.reply;
    await respond.call(ctx, 'Something went wrong', true).catch(() => {});
  }
}

export default {
  name: GatewayDispatchEvents.InteractionCreate,
  async execute({ data: interaction }) {
    switch (interaction.type) {
      case InteractionType.ApplicationCommand: {
        const command = commands.get(interaction.data.name);
        if (!command || !COMMAND_TYPES.has(interaction.data.type)) return;

        const ctx = createContext(interaction);
        const wait = command.cooldown && cooldown(`${command.data.name}:${ctx.userId}`, command.cooldown);
        if (wait) return ctx.reply(`Slow down, try again in ${wait}s`, true);

        await run(ctx, command, () => command.execute(ctx));
        return;
      }

      case InteractionType.ApplicationCommandAutocomplete: {
        const command = commands.get(interaction.data.name);
        const ctx = createContext(interaction);
        if (!command?.autocomplete || (command.owner && !isOwner(ctx))) return;

        await command.autocomplete(ctx).catch(console.error);
        return;
      }

      case InteractionType.MessageComponent:
      case InteractionType.ModalSubmit: {
        const [name, action, ...args] = interaction.data.custom_id.split(':');
        const command = commands.get(name);
        const ctx = createContext(interaction);
        if (command?.component) await run(ctx, command, () => command.component(ctx, action, args));
      }
    }
  },
};
