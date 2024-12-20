import "reflect-metadata";
import "dotenv/config";
import { OneBot } from "./OneBot/index.js";
import { PrismaClient } from "@prisma/client";
import { OneBotEvent, OneBotMessageEvent } from "./OneBot/event.js";
import assert from "assert";
import { Service, Container } from "typedi";
import { Logger } from "./service/log.js";

const prisma = new PrismaClient();

@Service()
export class DBWorker {
  constructor(private oneBot: OneBot, private logger: Logger) {
    this.oneBot.addListener("message", async (e) => {
      assert(e.self_id === 2339362968, "使用了错误的 QQ 号");

      switch (e.post_type) {
        case "message":
          this.handleMessageEvent(e);
          break;
        case "meta_event":
          break;

        default:
          break;
      }
    });
  }

  protected async handleMessageEvent(e: OneBotMessageEvent) {
    assert(Array.isArray(e.message), `Receive none array message: ${JSON.stringify(e.message)}`);

    if (e.message_type === "private") {
      this.logger.warn(`Private message from ${e.sender.nickname}(${e.user_id}) received`);
      return;
    }

    const groupId = e.group_id.toString();
    const userId = e.user_id.toString();

    await prisma.user.upsert({
      where: { userId },
      create: {
        userId,
        Group: {
          create: {
            groupId: groupId,
          },
        },
      },
      update: {
        Group: {
          upsert: {
            where: { groupId },
            create: { groupId },
            update: {},
          },
        },
      },
    });

    const msgId = e.message_id.toString();
    const msg = e.message;
    await prisma.message.create({
      data: {
        messageId: msgId,
        type: "group",
        user: { connect: { userId } },
        group: { connect: { groupId } },
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
                  this.logger.info(`Image Received, type: ${m.data.type}`);
                  content = m.data.file;
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
    });
  }

  public exit() {
    this.logger.info("Exiting...");
    this.oneBot.close();
  }
}

(function () {
  const worker = Container.get(DBWorker);

  process.on("SIGINT", () => {
    worker.exit();
    process.exit();
  });
})();
