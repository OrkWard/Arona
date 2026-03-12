import type { Effect } from "effect";
import type { OneBotMessageEvent, OneBotNoticeEvent, OneBotMetaEvent } from "onebot";
import type { S3Service, OneBotService, RedisService, WormfaceService, DbService } from "./services/index.js";
import { NodeContext } from "@effect/platform-node";
import { MlService } from "./services/ml.js";

export type Services = RedisService | S3Service | OneBotService | WormfaceService | MlService | DbService | NodeContext.NodeContext;

export interface EventPlugin {
  onMessage?: (event: OneBotMessageEvent) => Effect.Effect<void, Error, Services>;
  onNotice?: (event: OneBotNoticeEvent) => Effect.Effect<void, Error, Services>;
  onMeta?: (event: OneBotMetaEvent) => Effect.Effect<void, Error, Services>;
}

export interface CronPlugin {
  /** Cron expression for the task schedule */
  cron: string;
  /** The task to run on each schedule */
  task: Effect.Effect<void, Error, Services>;
}
