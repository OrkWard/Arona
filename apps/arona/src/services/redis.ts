import { createClient } from "redis";
import { AppConfig } from "./config.js";
import { logger } from "../util/logger.js";

export class RedisService {
  static inject = ["config"] as const;

  private _client?: ReturnType<typeof createClient>;

  constructor(private config: AppConfig) {}

  public async getClient() {
    if (this._client) {
      return this._client;
    }

    const client = createClient({ url: this.config.redisUrl });
    client.on("error", (err) => logger.error({ msg: "Redis error", error: err }));
    this._client = client;

    await client.connect().then(() => {
      logger.info("Redis connected");
    });

    return client;
  }
}
