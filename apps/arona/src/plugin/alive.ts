import { captureMessage } from "@sentry/node";
import { Effect } from "effect";

import type { EventPlugin } from "../types.js";

const MAX_REPORTS = 5;

/** 当收到异常心跳事件时上报异常，5 次后不再上报，收到常规心跳则重置上报次数 */
export function createAlivePlugin(): EventPlugin {
  let reportCount = 0;

  return {
    onMeta: (event) =>
      Effect.sync(() => {
        if (event.meta_event_type !== "heartbeat") {
          return;
        }
        if (!event.status.online && reportCount < MAX_REPORTS) {
          captureMessage("Bot status abnormal", {
            level: "fatal",
            extra: event,
          });
          reportCount += 1;
        } else if (event.status.online) {
          reportCount = 0;
        }
      }),
  };
}
