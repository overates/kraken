import { ComponentType, MessageFlags } from '@discordjs/core';
import { api } from './client.js';

export const COLOR = 0xb7ff60;

const embed = (description) => ({ embeds: [{ color: COLOR, description }] });
const flags = (ephemeral) => (ephemeral ? { flags: MessageFlags.Ephemeral } : {});

function modalFields(components = []) {
  const fields = new Map();

  for (const c of components) {
    const input = c.type === ComponentType.Label ? c.component : c.components?.[0];
    if (!input?.custom_id) continue;
    const value = input.values ?? input.value;
    fields.set(input.custom_id, typeof value === 'string' ? value.trim() : (value ?? ''));
  }

  return fields;
}

export function createContext(interaction) {
  const options = interaction.data?.options ?? [];
  const values = new Map(options.map((o) => [o.name, o.value]));
  const resolved = interaction.data?.resolved ?? {};
  const fields = modalFields(interaction.data?.components);
  const caller = interaction.member?.user ?? interaction.user;

  return {
    interaction,
    guildId: interaction.guild_id,
    botId: interaction.application_id,
    caller,
    userId: caller?.id,
    responded: false,

    focused: options.find((o) => o.focused),

    option: (name) => values.get(name),
    role: (name) => resolved.roles?.[values.get(name)],
    user: (name) => resolved.users?.[values.get(name)],
    member: (name) => resolved.members?.[values.get(name)],
    channel: (name) => resolved.channels?.[values.get(name)],
    target: resolved.messages?.[interaction.data?.target_id],
    targetUser: resolved.users?.[interaction.data?.target_id],
    field: (id) => fields.get(id) || null,
    values: (id) => (Array.isArray(fields.get(id)) ? fields.get(id) : []),
    attachments: (id) => (fields.get(id) ?? []).map((key) => resolved.attachments?.[key]).filter(Boolean),

    async choices(choices) {
      await api.interactions.createAutocompleteResponse(interaction.id, interaction.token, { choices });
    },

    async modal(data) {
      this.responded = true;
      await api.interactions.createModal(interaction.id, interaction.token, data);
    },

    async send(body, ephemeral = false) {
      this.responded = true;
      await api.interactions.reply(interaction.id, interaction.token, { ...body, ...flags(ephemeral) });
    },

    async update(body) {
      this.responded = true;
      await api.interactions.updateMessage(interaction.id, interaction.token, body);
    },

    async deferUpdate() {
      this.responded = true;
      await api.interactions.deferMessageUpdate(interaction.id, interaction.token);
    },

    async editMessage(body) {
      await api.interactions.editReply(interaction.application_id, interaction.token, body);
    },

    reply(description, ephemeral = false) {
      return this.send(embed(description), ephemeral);
    },

    async defer(ephemeral = false) {
      this.responded = true;
      await api.interactions.defer(interaction.id, interaction.token, flags(ephemeral));
    },

    async edit(description) {
      await api.interactions.editReply(interaction.application_id, interaction.token, embed(description));
    },

    async followUp(description, ephemeral = false) {
      await api.interactions.followUp(interaction.application_id, interaction.token, {
        ...embed(description),
        ...flags(ephemeral),
      });
    },
  };
}
