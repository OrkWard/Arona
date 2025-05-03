import { createClient } from "redis";
import { C } from "./config.js";
import { logger } from "./logger.js";

export const redis = await createClient({ url: C.REDIS })
  .on("connect", () => logger.info("Redis connected"))
  .connect();
