import "reflect-metadata";
import "dotenv/config";
import { OneBot } from "./OneBot/index.js";
import { Prisma, PrismaClient } from "@prisma/client";
import { OneBotMessageEvent } from "./OneBot/event.js";
import assert from "assert";
import { Service, Container } from "typedi";
import { Logger } from "./service/log.js";
import { AppConfig } from "./service/app.js";
import { ResultAsync } from "neverthrow";

const prisma = new PrismaClient();

@Service()
export class DBWorker {
  constructor(
    private oneBot: OneBot,
    private logger: Logger,
    private app: AppConfig
  ) {
    this.oneBot.addListener("message", async (e) => {
      assert(e.self_id === 2339362968, "使用了错误的 QQ 号");

      switch (e.post_type) {
        case "message":
          this.storeMessage(e);
          break;
        case "meta_event":
          break;

        default:
          break;
      }
    });
  }

  protected async storeMessage(e: OneBotMessageEvent) {
    assert(Array.isArray(e.message), `Receive none array message: ${JSON.stringify(e.message)}`);

    if (e.message_type === "private") {
      this.logger.warn(`Private message from ${e.sender.nickname}(${e.user_id}) received`);
      return;
    }

    const groupId = e.group_id.toString();
    const userId = e.user_id.toString();
    const msgId = e.message_id.toString();
    const msg = e.message;

    await ResultAsync.fromPromise<unknown, Error>(
      prisma.$transaction([
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
        }),
      ]),
      (e) => {
        if (e instanceof Prisma.PrismaClientKnownRequestError) {
          return new Error(`DB Known Error, code ${e.code}, message ${e.message}`);
        } else if (e instanceof Error) {
          return e;
        }
        return new Error(`DB Unkown Error: ${JSON.stringify(e)}`);
      }
    ).match(
      () => this.logger.debug("User, Group, Message has been all successfully updated"),
      (e) => {
        this.logger.error(e.message);
      }
    );
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
