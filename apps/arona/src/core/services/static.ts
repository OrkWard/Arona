import { Config, Effect, Layer } from "effect";
import { FileSystem } from "@effect/platform";
import Koa from "koa";
import { send } from "@koa/send";
import { logger } from "../../util/logger.js";

export class StaticServer extends Effect.Tag("static")<StaticServer, { origin: string }>() {}

export const StaticServerLive = Layer.scoped(
  StaticServer,
  Effect.gen(function* () {
    const rootPath = yield* Config.string("STATIC_ROOT");
    const host = yield* Config.string("STATIC_HOST");
    const port = yield* Config.string("STATIC_PORT");

    const fs = yield* FileSystem.FileSystem;
    if (!(yield* fs.exists(rootPath))) {
      yield* fs.makeDirectory(rootPath);
    }

    const app = new Koa();
    app.use(async (ctx) => {
      await send(ctx, ctx.path, { root: rootPath });
    });
    app.on("connection", () => {
      logger.info("Static server started");
    });
    const server = app.listen(host);
    yield* Effect.addFinalizer(() => Effect.succeed(server.close()));

    return StaticServer.of({ origin: `http://${host}:${port}` });
  })
);
