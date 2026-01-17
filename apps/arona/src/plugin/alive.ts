import { captureMessage } from "@sentry/node";
import { Effect } from "effect";

import type { EventPlugin } from "../types.js";

let reportCount = 0;
const MAX_REPORTS = 5;

export const AlivePlugin: EventPlugin = {
  onMeta: (event) =>
    Effect.sync(() => {
      if (event.meta_event_type === "heartbeat" && !event.status.online && reportCount < MAX_REPORTS) {
        captureMessage("Bot status abnormal", {
          level: "fatal",
          extra: event,
        });
        reportCount += 1;
      }
    }),
};
