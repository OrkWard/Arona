import { OneBot } from "./OneBot/index.js";
import { PrismaClient } from "@prisma/client";
import { logger } from "./utils/log.js";

const prisma = new PrismaClient();

export class Arona {
  private oneBot: OneBot;

  constructor() {
    this.oneBot = new OneBot("localhost:3001");

    this.oneBot.addListener("message", (e) => {
      logger.info("receive message");
    });
  }

  public exit() {
    this.oneBot.close();
  }
}
