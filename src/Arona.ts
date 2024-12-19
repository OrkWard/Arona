import { OneBot } from "./OneBot/index.js";
import { PrismaClient } from "@prisma/client";
import { OneBotEvent, OneBotMessageEvent } from "./OneBot/event.js";
import assert from "assert";
import { Service } from "typedi";
import { Logger } from "./utils/log.js";

const prisma = new PrismaClient();

@Service()
export class Arona {
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
      where: { userId: userId },
      create: {
        userId: userId,
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
    msg.forEach((m) => {
      switch (m.type) {
        case "text":
          // text
          break;
        case "at":
          // at
          break;
        case "file":
          // file
          break;
        case "image":
          // image
          break;
        case "reply":
          // reply
          break;
        default:
          break;
      }
    });
    await prisma.message.create({ data: { messageId: msgId, type: "group", user: { connect: { userId } } } });
  }

  public exit() {
    this.logger.info("Exiting...");
    this.oneBot.close();
  }
}
