CREATE TABLE IF NOT EXISTS "Guild" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "autoroleId" TEXT
);

CREATE TABLE IF NOT EXISTS "Lock" (
  "channelId" TEXT NOT NULL PRIMARY KEY,
  "guildId" TEXT NOT NULL,
  "allow" BIGINT NOT NULL,
  "deny" BIGINT NOT NULL,
  "bulk" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS "BanLimit" (
  "guildId" TEXT NOT NULL PRIMARY KEY,
  "limit" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "BanCount" (
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "count" INTEGER NOT NULL,
  PRIMARY KEY ("guildId", "userId")
);

CREATE TABLE IF NOT EXISTS "Freeze" (
  "guildId" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "FrozenPermission" (
  "guildId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL DEFAULT '',
  "targetId" TEXT NOT NULL,
  "type" INTEGER NOT NULL,
  "removed" BIGINT NOT NULL,
  PRIMARY KEY ("guildId", "channelId", "targetId")
);

CREATE TABLE IF NOT EXISTS "Gate" (
  "guildId" TEXT NOT NULL PRIMARY KEY,
  "minAge" INTEGER NOT NULL DEFAULT 0,
  "avatar" BOOLEAN NOT NULL DEFAULT false,
  "action" TEXT NOT NULL DEFAULT 'ban'
);

CREATE TABLE IF NOT EXISTS "AntiBot" (
  "guildId" TEXT NOT NULL PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS "ReportCount" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "day" TEXT NOT NULL,
  "count" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "ReportBlock" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Report" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "userId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "targetId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "replied" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Report_userId_idx" ON "Report" ("userId");

CREATE TABLE IF NOT EXISTS "Flag" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "userId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "messageId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Flag_userId_idx" ON "Flag" ("userId");

CREATE TABLE IF NOT EXISTS "Giveaway" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "guildId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "messageId" TEXT,
  "hostId" TEXT NOT NULL,
  "prize" TEXT NOT NULL,
  "description" TEXT,
  "winners" INTEGER NOT NULL,
  "endsAt" DATETIME NOT NULL,
  "ended" BOOLEAN NOT NULL DEFAULT false,
  "winnerIds" TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS "Giveaway_ended_endsAt_idx" ON "Giveaway" ("ended", "endsAt");
CREATE INDEX IF NOT EXISTS "Giveaway_guildId_idx" ON "Giveaway" ("guildId");

CREATE TABLE IF NOT EXISTS "GiveawayEntry" (
  "giveawayId" INTEGER NOT NULL,
  "userId" TEXT NOT NULL,
  PRIMARY KEY ("giveawayId", "userId")
);

CREATE TABLE IF NOT EXISTS "Shield" (
  "guildId" TEXT NOT NULL PRIMARY KEY,
  "categories" TEXT NOT NULL,
  "action" TEXT NOT NULL DEFAULT 'ban',
  "alertChannel" TEXT
);

CREATE TABLE IF NOT EXISTS "ShieldBan" (
  "guildId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  PRIMARY KEY ("guildId", "userId")
);
CREATE INDEX IF NOT EXISTS "ShieldBan_userId_idx" ON "ShieldBan" ("userId");

CREATE TABLE IF NOT EXISTS "Verification" (
  "guildId" TEXT NOT NULL PRIMARY KEY,
  "method" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "messageId" TEXT,
  "unverifiedRoleId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "overwrites" TEXT NOT NULL DEFAULT '[]'
);
