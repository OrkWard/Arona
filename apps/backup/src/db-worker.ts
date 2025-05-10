import assert from "assert";
import { PrismaClient } from "@prisma/client";

import { OneBot } from "onebot";
import { C } from "./config.js";

const prisma = new PrismaClient();

export class DBWorker {
  constructor(
    private oneBot: OneBot,
    private logger: Logger
  ) {
    this.oneBot.onMessage(async (e) => {
      assert(e.self_id === 2339362968, "使用了错误的 QQ 号");
      assert(Array.isArray(e.message), `Receive none array message: ${JSON.stringify(e.message)}`);

      if (e.message_type === "private") {
        this.logger.warn(`Private message from ${e.sender.nickname}(${e.user_id}) received`);
        return;
      }

      const groupId = e.group_id.toString();
      const userId = e.user_id.toString();
      const msgId = e.message_id.toString();
      const msg = e.message;

      await prisma.$transaction([
        // 存储用户和组
        prisma.user.upsert({
          where: { userId },
          create: {
            userId,
            Group: {
              connectOrCreate: {
                where: { groupId },
                create: { groupId },
              },
            },
          },
          update: {
            Group: {
              connectOrCreate: {
                where: { groupId },
                create: { groupId },
              },
            },
          },
        }),

        // 存储消息
        prisma.message.create({
          data: {
            messageId: msgId,
            type: "group",
            user: { connect: { userId } },
            group: { connect: { groupId } },
            time: new Date(e.time * 1000),
            segments: {
              createMany: {
                data: msg.map((m) => {
                  let content: string;
                  switch (m.type) {
                    case "text":
                      content = m.data.text;
                      break;
                    case "at":
                      content = m.data.qq;
                      break;
                    case "file":
                      content = m.data.file;
                      break;
                    case "image":
                      content = m.data.file || m.data.url;
                      break;
                    case "reply":
                      content = m.data.id;
                      break;
                    default:
                      content = JSON.stringify(m.data);
                      break;
                  }

                  return { content, type: m.type };
                }),
              },
            },
          },
        }),
      ]);
      this.logger.debug("User, Group, Message has been all successfully updated");
    });
  }

  public exit() {
    this.logger.info("Exiting...");
    this.oneBot.close();
  }
}

(function () {
  const logger = new Logger();
  const onebot = new OneBot(logger, {
    authKey: C.AUTH_TOKEN,
    origin: "sur4:3001",
  });
  const worker = new DBWorker(onebot, logger);

  process.on("SIGINT", () => {
    worker.exit();
    process.exit();
  });
})();
