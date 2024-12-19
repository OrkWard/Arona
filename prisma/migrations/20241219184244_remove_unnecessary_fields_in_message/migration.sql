/*
  Warnings:

  - You are about to drop the column `audio` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `file` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `replyToId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `video` on the `Message` table. All the data in the column will be lost.
  - Made the column `groupId` on table `Message` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("userId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("groupId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("groupId", "id", "messageId", "userId") SELECT "groupId", "id", "messageId", "userId" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE UNIQUE INDEX "Message_messageId_key" ON "Message"("messageId");
CREATE TABLE "new_Segment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "messageId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    CONSTRAINT "Segment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("messageId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Segment" ("content", "id", "messageId", "type") SELECT "content", "id", "messageId", "type" FROM "Segment";
DROP TABLE "Segment";
ALTER TABLE "new_Segment" RENAME TO "Segment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
