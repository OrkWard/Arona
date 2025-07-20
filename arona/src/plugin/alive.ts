import { onebot } from "../onebot.js";
import { AronaPlugin } from "./index.js";
import { captureException, captureMessage } from "@sentry/node";

export class AlivePlugin implements AronaPlugin {
  private callbackId: number | null = null;
  /** only report 5 times */
  private reportCount = 0;

  activate(): void {
    this.callbackId = onebot.on("meta_event", (event) => {
      if (event.meta_event_type === "heartbeat" && !event.status.online && this.reportCount < 5) {
        captureMessage("bot status inormal", {
          level: "fatal",
          extra: event,
        });
        this.reportCount += 1;
      }
    });
  }

  deactivate(): void {
    if (this.callbackId) {
      onebot.removeListener("message", this.callbackId);
    }
  }
}
