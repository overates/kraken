import { AutoModerationActionType, AutoModerationRuleEventType, AutoModerationRuleTriggerType } from '@discordjs/core';
import { api } from '../client.js';

const RULE_NAME = 'Kraken · Link block';

// AutoMod uses Rust regex, so no lookarounds. A plain dot must not be followed by a space or normal sentences would match
const DOT = String.raw`(?:\s?\.|\s*[\[(]\s*(?:\.|dot)?\s*[\])]\s*)`;

const TLDS = [
  'com|net|org|xyz|gg|io|co|me|tv|app|dev|link|site|online|top|info|biz|club|shop|store|live|fun|cc|us|uk',
  'de|tr|ru|tk|ml|ga|cf|gq|ly|to|be|in|eu|pw|ws|gift|gifts|win|click|lol|art|pro|vip|icu|cn|su|sh|ai|so|ph|lt',
];

const PATTERNS = [
  String.raw`(?i)\b(?:https?|ftp|hxxps?)\s*:\s*/\s*/`,
  String.raw`(?i)\bwww\s*[.,\[(]`,
  ...TLDS.map((list) => String.raw`(?i)\b[a-z0-9-]{2,}${DOT}(?:${list})\b`),
  String.raw`[\x{1D400}-\x{1D7FF}\x{FF10}-\x{FF5A}\x{24B6}-\x{24E9}\x{1F130}-\x{1F189}\x{1D00}-\x{1D2B}\x{1D43}-\x{1D61}]{3,}`,
];

const ALLOW = [
  'tenor.com',
  'giphy.com',
  'discord.com/channels',
  'discordapp.com/channels',
  'cdn.discordapp.com',
  'media.discordapp.net',
];

const find = async (guildId) =>
  (await api.guilds.getAutoModerationRules(guildId)).find((r) => r.name === RULE_NAME) ?? null;

export async function enable(guildId) {
  const body = {
    name: RULE_NAME,
    event_type: AutoModerationRuleEventType.MessageSend,
    trigger_type: AutoModerationRuleTriggerType.Keyword,
    trigger_metadata: { regex_patterns: PATTERNS, allow_list: ALLOW },
    actions: [
      { type: AutoModerationActionType.BlockMessage, metadata: { custom_message: 'Links are not allowed here' } },
    ],
    enabled: true,
  };

  const existing = await find(guildId);
  if (existing) await api.guilds.editAutoModerationRule(guildId, existing.id, body, { reason: 'Link block on' });
  else await api.guilds.createAutoModerationRule(guildId, body, { reason: 'Link block on' });
}

export async function disable(guildId) {
  const existing = await find(guildId);
  if (!existing) return false;
  await api.guilds.deleteAutoModerationRule(guildId, existing.id, { reason: 'Link block off' });
  return true;
}
