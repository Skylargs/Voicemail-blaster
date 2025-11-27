/*
  Warnings:

  - You are about to alter the column `campaignId` on the `CallLog` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `Campaign` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `status` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Campaign` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `Campaign` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `campaignId` on the `Lead` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to drop the column `cpsLimit` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `dailyCap` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `twilioAccountSid` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `twilioAuthToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `twilioFromNumber` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" INTEGER,
    "leadId" TEXT,
    "callSid" TEXT,
    "number" TEXT,
    "answeredBy" TEXT,
    "status" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CallLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CallLog" ("answeredBy", "callSid", "campaignId", "error", "id", "leadId", "number", "status", "success", "timestamp") SELECT "answeredBy", "callSid", "campaignId", "error", "id", "leadId", "number", "status", "success", "timestamp" FROM "CallLog";
DROP TABLE "CallLog";
ALTER TABLE "new_CallLog" RENAME TO "CallLog";
CREATE TABLE "new_Campaign" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Campaign" ("createdAt", "id", "name", "userId") SELECT "createdAt", "id", "name", "userId" FROM "Campaign";
DROP TABLE "Campaign";
ALTER TABLE "new_Campaign" RENAME TO "Campaign";
CREATE TABLE "new_Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" INTEGER NOT NULL,
    "name" TEXT,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastCallSid" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("attempts", "campaignId", "createdAt", "id", "lastCallSid", "name", "number", "status", "updatedAt") SELECT "attempts", "campaignId", "createdAt", "id", "lastCallSid", "name", "number", "status", "updatedAt" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "id", "passwordHash") SELECT "createdAt", "email", "id", "passwordHash" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
