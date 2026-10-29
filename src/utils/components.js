import { ButtonStyle, ComponentType, TextInputStyle } from '@discordjs/core';
import { COLOR } from '../context.js';

export const embed = (description) => ({ color: COLOR, description });

export const row = (...components) => ({ type: ComponentType.ActionRow, components });

export const button = (customId, label, style = ButtonStyle.Secondary, extra = {}) => ({
  type: ComponentType.Button,
  custom_id: customId,
  label,
  style,
  ...extra,
});

export const linkButton = (label, url) => ({ type: ComponentType.Button, style: ButtonStyle.Link, label, url });

export const textInput = ({ id, label, description, style = TextInputStyle.Short, required = true, ...input }) => ({
  type: ComponentType.Label,
  label,
  ...(description && { description }),
  component: { type: ComponentType.TextInput, custom_id: id, style, required, ...input },
});
