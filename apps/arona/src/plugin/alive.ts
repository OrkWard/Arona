import { OneBotMetaEvent } from "onebot/src/event.js";
import { captureException, captureMessage } from "@sentry/node";
import { Effect } from "effect";

export class AlivePlugin {
  /** only report 5 times */
  private reportCount = 0;

  onMeta(event: OneBotMetaEvent) {
    if (event.meta_event_type === "heartbeat" && !event.status.online && this.reportCount < 5) {
      captureMessage("bot status inormal", {
        level: "fatal",
        extra: event,
      });
      this.reportCount += 1;
    }

    return Effect.void;
  }
}
