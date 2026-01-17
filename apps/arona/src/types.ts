import type { Effect } from "effect";
import type { OneBotMessageEvent, OneBotNoticeEvent, OneBotMetaEvent } from "onebot";

export interface EventPlugin {
  onMessage?: (event: OneBotMessageEvent) => Effect.Effect<void, unknown, unknown>;
  onNotice?: (event: OneBotNoticeEvent) => Effect.Effect<void, unknown, unknown>;
  onMeta?: (event: OneBotMetaEvent) => Effect.Effect<void, unknown, unknown>;
}

export interface CronPlugin {
  /** The task to run on each interval */
  task: () => Effect.Effect<void, unknown, unknown>;
  /** Interval in milliseconds */
  interval: number;
}
