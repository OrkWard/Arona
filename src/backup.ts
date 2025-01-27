import { okAsync, ResultAsync } from "neverthrow";
import { OneBot, OneBotError } from "./OneBot/index.js";
import { Logger } from "./utils/log.js";
import { Prisma, PrismaClient } from "@prisma/client";
import { handleDBError } from "./utils/db.js";

const prisma = new PrismaClient();

const logger = new Logger({ debug: Boolean(process.env.DEBUG) || false });
const onebot = new OneBot(logger, { authKey: process.env.AUTH_TOKEN!, origin: "sur4:3001" });

function backup(sourceGroup: number, targetGroup: number) {
  let lock = false;

  return () => {
    if (lock) {
      return Promise.resolve(undefined);
    }
    lock = true;

    return ResultAsync.combine([
      onebot.post("get_group_member_list", { group_id: sourceGroup }),
      onebot.post("get_group_member_list", { group_id: targetGroup }),
      onebot.post("ArkShareGroup", { group_id: targetGroup }),
    ])
      .map(async ([sourceMembers, targetMembers, invitation]) => {
        const unjoin = new Set(sourceMembers.map((m) => m.user_id)).difference(
          new Set(targetMembers.map((m) => m.user_id))
        );
        logger.info(`Left ${unjoin.size} guys don't in the backup group`);
        const invited = await prisma.invite.findMany({
          where: { sourceGroupId: sourceGroup.toString(), AND: { targetGroupId: targetGroup.toString() } },
        });
        logger.info(`Already ${invited.length} guys received invite`);
        const unsent = [...unjoin.difference(new Set(invited.map((i) => Number(i.userId))))].slice(0, 1);
        return [unsent, invitation] as const;
      })
      .andThen(([members, invitation]) =>
        ResultAsync.combine(
          members.map((m) =>
            onebot
              .post("send_private_msg", {
                user_id: m,
                message: [
                  { type: "text", data: { text: "好久不见，老师！别忘了接入什亭之匣的备份，防止丢失讯号哦！" } },
                  { type: "text", data: { text: targetGroup.toString() } },
                ],
                group_id: sourceGroup,
              })
              // .andThen(() =>
              //   onebot.post("send_private_msg", {
              //     user_id: m,
              //     message: [{ type: "json", data: { data: invitation } }],
              //     group_id: sourceGroup,
              //   })
              // )
              .andThen(() =>
                ResultAsync.fromPromise(
                  prisma.invite.create({
                    data: {
                      sourceGroupId: sourceGroup.toString(),
                      targetGroupId: targetGroup.toString(),
                      userId: m.toString(),
                    },
                  }),
                  (e) => handleDBError(e)
                )
              )
          )
        )
      )
      .match(
        () => {
          logger.info("Sync Success");
          return true;
        },
        (e) => {
          logger.error(e);
          return false;
        }
      )
      .finally(() => {
        lock = false;
      });
  };
}

const sourceGroup = 663985246;
const targetGroup = 940273522;
const task1 = backup(sourceGroup, targetGroup);
let waitTime = 0;
let waitStep = 60;

setInterval(() => {
  if (waitTime > 0) {
    waitTime -= 1;
    waitTime % 5 === 0 && logger.warn(`skip, remaing: ${waitTime}`);
    return;
  }

  task1().then((result) => {
    if (result === true) {
      waitTime = 0;
      waitStep = 60;
    } else if (result === false) {
      waitTime += waitStep;
      waitStep *= 2;
    }
  });
}, 1 * 1000);

function graceExit() {
  onebot.close();
  process.exit();
}

process.on("SIGINT", graceExit);
