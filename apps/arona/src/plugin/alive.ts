import { captureMessage } from "@sentry/node";
import { EventPlugin } from "../core/plugin.js";
import { OneBotMetaEvent } from "onebot";

const MAX_REPORTS = 5;

/** 当收到异常心跳事件时上报异常，5 次后不再上报，收到常规心跳则重置上报次数 */
export class AlivePlugin extends EventPlugin {
  private reportCount = 0;

  async onMeta(event: OneBotMetaEvent) {
    if (event.meta_event_type !== "heartbeat") {
      return;
    }
    if (!event.status.online && this.reportCount < MAX_REPORTS) {
      captureMessage("Bot status abnormal", {
        level: "fatal",
        extra: event,
      });
      this.reportCount += 1;
    } else if (event.status.online) {
      this.reportCount = 0;
    }
  }
}
