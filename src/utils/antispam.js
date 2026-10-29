import { AutoModerationActionType, AutoModerationRuleEventType, AutoModerationRuleTriggerType } from '@discordjs/core';
import { api } from '../client.js';

const PREFIX = 'Kraken · ';
const TIMEOUT = 600;

const block = { type: AutoModerationActionType.BlockMessage, metadata: { custom_message: 'Blocked by antispam' } };
const timeout = { type: AutoModerationActionType.Timeout, metadata: { duration_seconds: TIMEOUT } };

const RULES = [
  {
    label: 'Spam filter',
    trigger_type: AutoModerationRuleTriggerType.Spam,
    actions: [block],
  },
  {
    label: 'Mention spam',
    trigger_type: AutoModerationRuleTriggerType.MentionSpam,
    trigger_metadata: { mention_total_limit: 5, mention_raid_protection_enabled: true },
    actions: [block, timeout],
  },
  {
    label: 'Invite links',
    trigger_type: AutoModerationRuleTriggerType.Keyword,
    trigger_metadata: { regex_patterns: ['(discord\\.gg|discord(app)?\\.com/invite)/[a-zA-Z0-9-]+'] },
    actions: [block],
  },
];

const SINGLETON = [AutoModerationRuleTriggerType.Spam, AutoModerationRuleTriggerType.MentionSpam];

export async function enable(guildId) {
  const existing = await api.guilds.getAutoModerationRules(guildId);
  const active = [];
  const covered = [];
  const failed = [];

  for (const { label, ...rule } of RULES) {
    const name = PREFIX + label;
    const own = existing.find((r) => r.name === name);
    const body = { ...rule, name, event_type: AutoModerationRuleEventType.MessageSend, enabled: true };

    if (!own && SINGLETON.includes(rule.trigger_type) && existing.some((r) => r.trigger_type === rule.trigger_type)) {
      covered.push(label);
      continue;
    }

    try {
      if (own) {
        await api.guilds.editAutoModerationRule(guildId, own.id, body, { reason: 'Antispam on' });
      } else {
        await api.guilds.createAutoModerationRule(guildId, body, { reason: 'Antispam on' });
      }
      active.push(label);
    } catch (error) {
      console.error(error);
      failed.push(label);
    }
  }

  return { active, covered, failed };
}

export async function disable(guildId) {
  const own = (await api.guilds.getAutoModerationRules(guildId)).filter((r) => r.name.startsWith(PREFIX));

  await Promise.all(own.map((r) => api.guilds.deleteAutoModerationRule(guildId, r.id, { reason: 'Antispam off' })));

  return own.length;
}
