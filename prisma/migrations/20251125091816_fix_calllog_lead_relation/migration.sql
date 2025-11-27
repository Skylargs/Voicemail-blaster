/*
  Warnings:

  - You are about to drop the column `error` on the `CallLog` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `CallLog` table. All the data in the column will be lost.
  - You are about to alter the column `leadId` on the `CallLog` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `Lead` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `lastCallSid` on the `Lead` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Lead` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `Lead` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CallLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" INTEGER,
    "leadId" INTEGER,
    "callSid" TEXT,
    "number" TEXT,
    "status" TEXT,
    "answeredBy" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CallLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CallLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CallLog" ("answeredBy", "callSid", "campaignId", "id", "leadId", "number", "status", "success") SELECT "answeredBy", "callSid", "campaignId", "id", "leadId", "number", "status", "success" FROM "CallLog";
DROP TABLE "CallLog";
ALTER TABLE "new_CallLog" RENAME TO "CallLog";
CREATE TABLE "new_Lead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" INTEGER NOT NULL,
    "name" TEXT,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lead_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Lead" ("attempts", "campaignId", "createdAt", "id", "name", "number", "status") SELECT "attempts", "campaignId", "createdAt", "id", "name", "number", "status" FROM "Lead";
DROP TABLE "Lead";
ALTER TABLE "new_Lead" RENAME TO "Lead";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
