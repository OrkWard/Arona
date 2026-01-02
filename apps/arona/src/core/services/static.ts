import { Config, Effect, Layer } from "effect";
import { FileSystem } from "@effect/platform";
import Koa from "koa";
import { send } from "@koa/send";
import { logger } from "../../util/logger.js";

export class StaticService extends Effect.Tag("static")<StaticService, { origin: string }>() {
  static Live = Layer.scoped(
    StaticService,
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

      return StaticService.of({ origin: `http://${host}:${port}` });
    })
  );
}
