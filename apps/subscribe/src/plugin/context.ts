import { createClient } from "redis";
import Koa from "koa";
import { send } from "@koa/send";
import { existsSync, mkdirSync } from "node:fs";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { AppRouter } from "trpc-server/src/index.js";

import { C } from "../config.js";
import { logger } from "../util/logger.js";

export const redis = await createClient({ url: C.REDIS })
  .on("connect", () => logger.info("Redis connected"))
  .connect();

// setup file server
function serverStatic() {
  if (!existsSync(C.STATIC_ROOT)) {
    mkdirSync(C.STATIC_ROOT);
  }

  const app = new Koa();
  app.use(async (ctx) => {
    await send(ctx, ctx.path, { root: C.STATIC_ROOT });
  });
  app.listen(C.STATIC_PORT);
  logger.info("Static server started");

  return `http://${C.STATIC_HOST}:${C.STATIC_PORT}`;
}
export const staticOrigin = serverStatic();

export const trpc = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: C.TRPC_SERVER })] });
