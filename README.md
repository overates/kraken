<div align="center">

<img width="3000" height="750" alt="Untitled-6" src="https://github.com/user-attachments/assets/cbf43f4a-e284-4d89-8e08-82f2ca23b80e" />

**Guard and moderation bot for Discord**

[![Node](https://img.shields.io/badge/node-22+-b7ff60?style=flat-square&labelColor=0b0d09)](https://nodejs.org)
[![discord.js](https://img.shields.io/badge/discord.js-core-b7ff60?style=flat-square&labelColor=0b0d09)](https://discord.js.org)
[![SQLite](https://img.shields.io/badge/sqlite-wal-b7ff60?style=flat-square&labelColor=0b0d09)](https://github.com/WiseLibs/better-sqlite3)

[Features](#features) · [Preview](#preview) · [Commands](#commands) · [Setup](#setup)

</div>

<br>

## Features

<table>
  <tr>
    <td width="33%" valign="top">
      <h3>Shield</h3>
      Users flagged by Kraken are banned in every protected server, before they can even join
    </td>
    <td width="33%" valign="top">
      <h3>Verification</h3>
      New members solve a captcha before they can see anything. Nothing is stored while they do
    </td>
    <td width="33%" valign="top">
      <h3>Anti nuke</h3>
      Daily ban limits, a one click freeze for every dangerous permission and automatic bot kicking
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <h3>AutoMod</h3>
      Links, hidden links, fancy fonts, spam and mass mentions are blocked by Discord itself
    </td>
    <td width="33%" valign="top">
      <h3>Reports</h3>
      Right click any message to report it. The team gets a rendered copy, so proof can't be faked
    </td>
    <td width="33%" valign="top">
      <h3>Backups</h3>
      The whole server, from roles to emojis and bans, saved to a single <code>.kraken</code> file
    </td>
  </tr>
</table>

Runs with no gateway cache: memory stays flat no matter how many servers the bot is in.

## Preview

<table>
  <tr>
    <td width="50%"><img src="https://github.com/user-attachments/assets/24f227f8-c16f-459e-95be-c322971dccb8" alt="Whois card"></td>
    <td width="50%"><img src="https://github.com/user-attachments/assets/178980a1-1785-4f64-a57a-34fd9c1e1ad6" alt="Message report"></td>
  </tr>
  <tr>
    <td align="center"><sub>Whois</sub></td>
    <td align="center"><sub>Message report</sub></td>
  </tr>

  <tr>
    <td width="50%"><img src="https://github.com/user-attachments/assets/cc2b019c-6846-41fb-b6f0-21fde2ea9de3" alt="Captcha verification"></td>
    <td width="50%"><img src="https://github.com/user-attachments/assets/5df249f1-20e1-4e36-97a9-7446774049d9" alt="Giveaway"></td>
  </tr>
  <tr>
    <td align="center"><sub>Verification</sub></td>
    <td align="center"><sub>Giveaway</sub></td>
  </tr>
</table>

## Commands

<details>
<summary><b>Protection</b></summary>
<br>

| Command | Description |
| --- | --- |
| `/shield` | Block users flagged by Kraken across servers |
| `/verification` | Captcha verification for new members |
| `/gate` | Ban or kick new accounts and accounts without an avatar |
| `/antibot` | Kick bots added by anyone other than the owner |
| `/freeze` | Remove every dangerous permission until turned off |
| `/banlimit` | Limit bans per moderator per day |
| `/antispam` | AutoMod rules for spam, mass mentions and invites |
| `/blocklink` | AutoMod rule for links and fancy fonts |

</details>

<details>
<summary><b>Moderation</b></summary>
<br>

| Command | Description |
| --- | --- |
| `/ban` · `/unban` | Ban or unban a user |
| `/lock` · `/unlock` | Lock one channel or all of them |
| `/autorole` | Role given to everyone who joins |
| `/backup` | Save the server to a file or restore it |
| `/giveaway` | Giveaways with a join button |
| `/perms` · `/hooks` | Audit dangerous permissions and webhooks |

</details>

<details>
<summary><b>Users</b></summary>
<br>

| Command | Description |
| --- | --- |
| `/whois` | User card with record and risk level |
| `/avatar` · `/banner` | Full size avatar and banner |
| `/report` | Report a user, a server or a problem |
| Right click › Apps | Whois, Avatar, Banner, Report Message |

</details>

> [!TIP]
> Add Kraken with **Add App › Add to My Apps** to use the user commands in DMs and in servers without the bot.

## Setup

Requires Node.js 22 or newer.

```bash
npm install
```

<details>
<summary><b>Environment variables</b></summary>
<br>

| Key | Description |
| --- | --- |
| `TOKEN` | Bot token |
| `CLIENT_ID` | Application ID |
| `DATABASE_PATH` | SQLite file, for example `data/kraken.db` |
| `OWNER_ID` | Your user ID, unlocks owner commands |
| `OWNER_GUILD_ID` | Server where owner commands are registered |
| `REPORT_CHANNEL_ID` | Channel that receives reports |
| `WANTED_CHANNEL_ID` | Channel where flagged users are announced |
| `VERIFY_SECRET` | Long random string used to sign captchas |

</details>

```bash
npm run deploy   # register slash commands
npm start
```

> [!IMPORTANT]
> Enable the **Server Members** intent in the Developer Portal, otherwise the bot can't see new members.

<br>

<div align="center">
<sub>Built with <a href="https://github.com/discordjs/discord.js">discord.js</a>, <a href="https://github.com/WiseLibs/better-sqlite3">better-sqlite3</a> and <a href="https://github.com/Brooooooklyn/canvas">@napi-rs/canvas</a></sub>
</div>
