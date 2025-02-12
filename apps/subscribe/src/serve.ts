import Koa from "koa";
import { send } from "@koa/send";

export function serverStatic(path: string, port: number) {
  const app = new Koa();
  app.use(async (ctx) => {
    await send(ctx, ctx.path, { root: path });
  });
  app.listen(port);
}
