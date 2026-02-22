import { Context, Layer } from "effect";
import type { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

export class RedisService extends Context.Tag("RedisService")<RedisService, { readonly client: RedisClient }>() {
  static makeLive = (client: RedisClient) => Layer.succeed(RedisService, RedisService.of({ client }));
}
