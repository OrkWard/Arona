import { OneBot, OneBotMessageEvent, OneBotMetaEvent, OneBotNoticeEvent } from "onebot";
import { AppConfig } from "../services/config.js";
import { RedisService } from "../services/redis.js";
import { WormfaceService } from "../services/wormface.js";
import { DbService } from "../services/db.js";
import { MlService } from "../services/ml.js";
import { S3Service } from "../services/media.js";

export class BasePlugin {
  static inject = ["config", "redis", "onebot", "wormface", "db", "ml", "s3"] as const;

  constructor(
    protected config: AppConfig,
    protected redis: RedisService,
    protected onebot: OneBot,
    protected wormface: WormfaceService,
    protected db: DbService,
    protected ml: MlService,
    protected s3: S3Service
  ) {}
}

export class EventPlugin extends BasePlugin {
  async onMessage(event: OneBotMessageEvent) {}
  async onNotice(event: OneBotNoticeEvent) {}
  async onMeta(event: OneBotMetaEvent) {}
}

export class CronPlugin extends BasePlugin {
  cron: string = "invalid";
  async task() {}
}
