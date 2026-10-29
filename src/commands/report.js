import { SlashCommandBuilder } from '@discordjs/builders';
import { ApplicationIntegrationType, ButtonStyle, InteractionContextType, PermissionFlagsBits } from '@discordjs/core';
import { api } from '../client.js';
import { avatarUrl } from '../utils/cdn.js';
import { button, embed, row } from '../utils/components.js';
import { flagEmoji, latestFlags } from '../utils/flags.js';
import { plural, timestamp } from '../utils/format.js';
import { memberCan } from '../utils/permissions.js';
import { renderMessage } from '../utils/render.js';
import {
  BLOCKED,
  LIMIT_REACHED,
  addReply,
  cleanEmbeds,
  createReport,
  deleteReport,
  downloadImages,
  history,
  isBlocked,
  logButtons,
  logEmbeds,
  logState,
  markReplied,
  pending,
  release,
  remaining,
  replyModal,
  reportModal,
  reserve,
  setBlocked,
  setStatus,
  trimHistory,
} from '../utils/reports.js';

const CHANNEL = process.env.REPORT_CHANNEL_ID;
const STATUS = { open: 'Open', resolved: 'Resolved' };

const leftText = (left) => (left ? `${plural(left, 'report')} left today` : 'No reports left today');

const INTRO = [
  'Need help or want to report something?',
  'Send it to the Kraken team and we will look into it',
  '',
  '**You can report**',
  '› Scammers and suspicious users',
  '› Servers breaking the rules',
  '› Commands that are not working',
  '› Any other problem',
].join('\n');

async function home(userId, note) {
  const left = remaining(userId);

  return {
    embeds: [{ ...embed(note ?? INTRO), footer: { text: leftText(left) } }],
    components: [
      row(
        button('report:open', 'Send Report', ButtonStyle.Primary, { disabled: left <= 0 }),
        button('report:list', 'My Reports'),
      ),
    ],
  };
}

async function list(userId) {
  const reports = history(userId);
  const flags = latestFlags([...new Set(reports.map((r) => r.targetId).filter(Boolean))]);

  const target = (id) => {
    const reason = flags.get(id);
    return `> <@${id}> · ${reason ? `${flagEmoji(reason)}Flagged as **${reason}**` : 'Not flagged yet'}`;
  };

  const lines = reports.length
    ? reports.flatMap((r) => {
        const status = r.status === 'open' && r.replied ? 'Replied' : STATUS[r.status];
        const subject = r.subject.length > 50 ? `${r.subject.slice(0, 50)}…` : r.subject;
        const line = `\`#${r.id}\` ${subject} · **${status}** · ${timestamp(r.createdAt.getTime())}`;
        return r.targetId ? [line, target(r.targetId)] : [line];
      })
    : ['You have no reports yet'];

  return {
    embeds: [{ ...embed(lines.join('\n')), footer: { text: 'Your last 10 reports' } }],
    components: [row(button('report:home', 'Back'))],
  };
}

async function snapshot(message, files) {
  const [first, ...rest] = files;
  const data = await renderMessage({ ...message, avatarUrl: avatarUrl(message.author, 64) }, first?.data);
  return [{ name: 'message.png', data, contentType: 'image/png' }, ...rest];
}

async function deliver(ctx, { subject, label = subject, details, attachments, message }) {
  const left = reserve(ctx.userId);
  if (left === null) return null;

  const report = createReport(ctx.userId, label, message?.author.id);
  const [guild, downloaded] = await Promise.all([
    ctx.guildId ? api.guilds.get(ctx.guildId).catch(() => ({ id: ctx.guildId, name: 'Server without Kraken' })) : null,
    downloadImages(attachments),
  ]);
  const files = message ? await snapshot(message, downloaded) : downloaded;

  try {
    await api.channels.createMessage(CHANNEL, {
      embeds: logEmbeds({
        id: report.id,
        reporter: ctx.caller,
        subject,
        details,
        guild,
        message,
        images: files.map((f) => f.name),
      }),
      components: logButtons(ctx.userId, report.id),
      files,
    });
  } catch (error) {
    await Promise.all([deleteReport(report.id), release(ctx.userId)]);
    throw error;
  }

  trimHistory(ctx.userId);
  return report.id;
}

const sentText = (id) => `Report \`#${id}\` sent, the Kraken team will review it`;

async function submit(ctx) {
  if (isBlocked(ctx.userId)) return ctx.update({ embeds: [embed(BLOCKED)], components: [] });
  if (remaining(ctx.userId) <= 0) return ctx.update(await home(ctx.userId));

  await ctx.deferUpdate();

  const id = await deliver(ctx, {
    subject: ctx.field('subject'),
    details: ctx.field('details'),
    attachments: ctx.attachments('images'),
  });

  await ctx.editMessage(await home(ctx.userId, id ? sentText(id) : undefined));
}

async function submitMessage(ctx) {
  const message = pending.take(ctx.userId);
  if (!message) return ctx.reply('This report expired, try again', true);
  if (isBlocked(ctx.userId)) return ctx.reply(BLOCKED, true);

  await ctx.defer(true);

  const reason = ctx.field('reason');
  const id = await deliver(ctx, {
    subject: reason,
    label: `Message · ${reason}`,
    details: ctx.field('details'),
    attachments: message.attachments,
    message,
  });

  await ctx.edit(id ? sentText(id) : LIMIT_REACHED);
}

async function sendReply(ctx, userId, reportId) {
  const message = ctx.field('message');

  try {
    const dm = await api.users.createDM(userId);
    await api.channels.createMessage(dm.id, {
      embeds: [
        {
          ...embed(message),
          author: { name: `Reply to report #${reportId}` },
          footer: { text: `From ${ctx.caller.username}` },
        },
      ],
    });
  } catch {
    return ctx.reply(`Could not send a DM to <@${userId}>`, true);
  }

  markReplied(reportId);

  const { message: log } = ctx.interaction;
  const [main, ...gallery] = cleanEmbeds(log.embeds);
  await ctx.update({
    embeds: [addReply(main, ctx.caller.username, message), ...gallery],
    components: logButtons(userId, reportId, logState(log)),
  });
}

async function setState(ctx, userId, reportId, change) {
  const { message } = ctx.interaction;
  const state = { ...logState(message), ...change };
  const embeds = cleanEmbeds(message.embeds);

  if ('resolved' in change) {
    setStatus(reportId, change.resolved ? 'resolved' : 'open');
    embeds[0].footer = {
      text: `Report #${reportId} · ${change.resolved ? `Resolved by ${ctx.caller.username}` : 'Open'}`,
    };
  }

  await ctx.update({ embeds, components: logButtons(userId, reportId, state) });
}

export default {
  data: new SlashCommandBuilder()
    .setName('report')
    .setDescription('Send a report to the Kraken team')
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel),

  async execute(ctx) {
    if (isBlocked(ctx.userId)) return ctx.reply(BLOCKED, true);

    await ctx.send(await home(ctx.userId), true);
  },

  async component(ctx, action, [userId, reportId]) {
    switch (action) {
      case 'open':
        if (isBlocked(ctx.userId)) return ctx.update({ embeds: [embed(BLOCKED)], components: [] });
        if (remaining(ctx.userId) <= 0) return ctx.update(await home(ctx.userId));
        return ctx.modal(reportModal);
      case 'submit':
        return submit(ctx);
      case 'message':
        return submitMessage(ctx);
      case 'list':
        return ctx.update(await list(ctx.userId));
      case 'home':
        return ctx.update(await home(ctx.userId));
    }

    if (!memberCan(ctx, PermissionFlagsBits.ManageGuild)) {
      return ctx.reply('You need **Manage Server**', true);
    }

    const id = Number(reportId);

    switch (action) {
      case 'reply':
        return ctx.modal(replyModal(userId, id));
      case 'send':
        return sendReply(ctx, userId, id);
      case 'resolve':
      case 'reopen':
        return setState(ctx, userId, id, { resolved: action === 'resolve' });
      case 'block':
      case 'unblock':
        setBlocked(userId, action === 'block');
        return setState(ctx, userId, id, { blocked: action === 'block' });
    }
  },
};
