import Koa from "koa";
import { send } from "@koa/send";
import { existsSync, mkdirSync } from "node:fs";
import { C } from "./config.js";

// setup file server
export function serverStatic() {
  if (!existsSync(C.STATIC_ROOT)) {
    mkdirSync(C.STATIC_ROOT);
  }

  const app = new Koa();
  app.use(async (ctx) => {
    await send(ctx, ctx.path, { root: C.STATIC_ROOT });
  });
  app.listen(C.STATIC_PORT);

  return `http://${C.STATIC_HOST}:${C.STATIC_PORT}`;
}
