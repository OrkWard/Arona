import { Context, Effect, Layer } from "effect";
import { createClient } from "redis";
import { logger } from "../../util/logger.js";

export class RedisService extends Context.Tag("redis")<
  RedisService,
  { readonly client: ReturnType<typeof createClient> }
>() {
  static Live = Layer.scoped(
    RedisService,
    Effect.gen(function* () {
      const client = createClient({ url: process.env.REDIS });

      client.on("error", (err) => {
        logger.error("Redis Client Error:", err);
      });

      yield* Effect.tryPromise({
        try: () => client.connect(),
        catch: (error) => new Error(`Redis connection failed: ${error}`),
      });

      yield* Effect.logInfo("Redis connected successfully");

      yield* Effect.addFinalizer(() => Effect.succeed(() => client.destroy()));

      return RedisService.of({ client });
    })
  );
}
