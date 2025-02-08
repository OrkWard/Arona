import { OneBot, Logger } from "onebot";
import { Prisma, PrismaClient } from "@prisma/client";
import { handleDBError } from "./utils/db.js";

const prisma = new PrismaClient();

const logger = new Logger({ debug: Boolean(process.env.DEBUG) || false });
const onebot = new OneBot(logger, {
  authKey: process.env.AUTH_TOKEN!,
  origin: "sur4:3001",
});

function sendInvitation(sourceGroup: number, targetGroup: number) {
  let lock = false;

  return async () => {
    if (lock) {
      return undefined;
    }
    lock = true;

    // {{{ get members that haven't joined target and receive invitation
    const sourceMem = await onebot.post("get_group_member_list", { group_id: sourceGroup });
    const targetMem = await onebot.post("get_group_member_list", { group_id: targetGroup });
    // const invitation = await onebot.post("ArkShareGroup", { group_id: targetGroup });
    const unjoinMem = new Set(sourceMem.map((m) => m.user_id)).difference(new Set(targetMem.map((m) => m.user_id)));
    logger.info(`Left ${unjoinMem.size} guys don't in the backup group`);
    const invitedMem = await prisma.invite.findMany({
      where: {
        sourceGroupId: sourceGroup.toString(),
        AND: { targetGroupId: targetGroup.toString() },
      },
    });
    logger.info(`Already ${invitedMem.length} guys received invite`);
    const unsendMem = [...unjoinMem.difference(new Set(invitedMem.map((i) => Number(i.userId))))].slice(0, 1);
    // }}}

    for (const m of unsendMem) {
      await onebot
        .sendPrivateMsg({
          user_id: m,
          message: [
            {
              type: "text",
              data: {
                text: "好久不见，老师！别忘了接入什亭之匣的备份，防止丢失讯号哦！",
              },
            },
            { type: "text", data: { text: targetGroup.toString() } },
          ],
          group_id: sourceGroup,
        })
        .then(() =>
          prisma.invite.create({
            data: {
              sourceGroupId: sourceGroup.toString(),
              targetGroupId: targetGroup.toString(),
              userId: m.toString(),
            },
          })
        )
        // ignore error here
        .catch((e) => console.error(e));
    }

    logger.info("Sync Success");

    lock = false;
  };
}

function backupGroup(group: number) {}

function backupEssence(group: number) {
  return onebot.post("get_essence_msg_list", { group_id: group });
}

const sourceGroup = 663985246;
const targetGroup = 940273522;
const task1 = sendInvitation(sourceGroup, targetGroup);

setInterval(() => {
  task1();
}, 1 * 1000);

function graceExit() {
  onebot.close();
  process.exit();
}

process.on("SIGINT", graceExit);
