-- CreateTable
CREATE TABLE "Invite" (
    "userId" TEXT NOT NULL,
    "sourceGroupId" TEXT NOT NULL,
    "targetGroupId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "sourceGroupId", "targetGroupId")
);
