import { OneBot } from "./OneBot/index.js";
import { Logger } from "./utils/log.js";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

(function () {
  const logger = new Logger();
  const onebot = new OneBot(logger, { authKey: process.env.AUTH_TOKEN!, origin: "sur4:3001" });
  setInterval(() => {
    // onebot.post('send_group_msg', actionParams)
  });

  process.on("SIGINT", () => {
    onebot.close();
    process.exit();
  });
})();
