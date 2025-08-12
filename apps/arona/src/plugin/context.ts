import { createClient } from "redis";
import Koa from "koa";
import { send } from "@koa/send";
import { existsSync, mkdirSync } from "node:fs";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { AppRouter } from "trpc-server/src/index.js";
import { logger } from "../util/logger.js";

export const redis = await createClient({ url: process.env.REDIS })
  .on("connect", () => logger.info("Redis connected"))
  .connect();

// setup file server
function serverStatic() {
  const { STATIC_ROOT, STATIC_HOST, STATIC_PORT } = process.env;
  if (!existsSync(STATIC_ROOT)) {
    mkdirSync(STATIC_ROOT);
  }

  const app = new Koa();
  app.use(async (ctx) => {
    await send(ctx, ctx.path, { root: STATIC_ROOT });
  });
  app.listen(STATIC_PORT);
  logger.info("Static server started");

  return `http://${STATIC_HOST}:${STATIC_PORT}`;
}
export const staticOrigin = serverStatic();

export const trpc = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: process.env.TRPC_SERVER })] });
