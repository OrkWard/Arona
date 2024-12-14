import { OneBot } from "./OneBot/index.js";
import { PrismaClient } from "@prisma/client";
import { logger } from "./utils/log.js";
import { OneBotEvent, OneBotMessageEvent } from "./OneBot/event.js";
import assert from "assert";

const prisma = new PrismaClient();

export class Arona {
  private oneBot: OneBot;

  constructor() {
    this.oneBot = new OneBot("sur4:3001", { auth: process.env.AUTH_TOKEN });

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

      // Save the message to the database
      try {
        // await prisma.message.create({
        //   data: {
        //     messageId: e.message_id.toString(),
        //     text: typeof e.message === "string" ? e.message : null,
        //     type: e.message_type,
        //     user: {
        //       connectOrCreate: {
        //         where: { userId: e.user_id.toString() },
        //         create: { userId: e.user_id.toString() },
        //       },
        //     },
        //     group:
        //       e.message_type === "group"
        //         ? {
        //             connectOrCreate: {
        //               where: { groupId: e.group_id.toString() },
        //               create: { groupId: e.group_id.toString(), groupName: "" },
        //             },
        //           }
        //         : undefined,
        //   },
        // });
        // logger.info("Message saved to database");
      } catch (error) {
        logger.error("Failed to save message to database", error);
      }
    });
  }

  protected async handleMessageEvent(e: OneBotMessageEvent) {
    assert(Array.isArray(e.message), `Receive none array message: ${JSON.stringify(e.message)}`);

    if (e.message_type === "private") {
      logger.warn(`Private message from ${e.sender.nickname}(${e.user_id}) received`);
      return;
    }

    const groupId = e.group_id;
    const userId = e.user_id;
    await prisma.user.upsert({
      where: { userId: userId.toString() },
      create: { userId: userId.toString() },
      update: {},
    });
  }

  public exit() {
    this.oneBot.close();
  }
}
