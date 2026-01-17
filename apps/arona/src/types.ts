import type { Effect } from "effect";
import type { OneBotMessageEvent, OneBotNoticeEvent, OneBotMetaEvent } from "onebot";
import type { MediaService, OneBotService, RedisService, WormfaceService } from "./services/index.js";
import { NodeContext } from "@effect/platform-node";

export type Services = RedisService | MediaService | OneBotService | WormfaceService | NodeContext.NodeContext;

export interface EventPlugin {
  onMessage?: (event: OneBotMessageEvent) => Effect.Effect<void, unknown, Services>;
  onNotice?: (event: OneBotNoticeEvent) => Effect.Effect<void, unknown, Services>;
  onMeta?: (event: OneBotMetaEvent) => Effect.Effect<void, unknown, Services>;
}

export interface CronPlugin {
  /** The task to run on each interval */
  task: Effect.Effect<void, unknown, Services>;
  /** Interval in milliseconds */
  interval: number;
}
