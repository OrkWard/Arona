import Koa from "koa";
import { send } from "@koa/send";
import { existsSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import C from "../config.json" with { type: "json" };

// setup file server
export function serverStatic() {
  if (!existsSync(C.STATIC_ROOT)) {
    mkdirSync(C.STATIC_ROOT);
  }
  const hostname = execSync("tailscale status --peers=false | awk '{print $2}'");

  const app = new Koa();
  app.use(async (ctx) => {
    await send(ctx, ctx.path, { root: C.STATIC_ROOT });
  });
  app.listen(C.STATIC_PORT);

  return `http://${hostname}:${C.STATIC_PORT}`;
}
