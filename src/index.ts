import type { OneBotActions } from "./action.ts";
import type { OneBotEvents } from "./event.ts";

declare class Arona {
  request<T extends keyof OneBotActions>(
    actionName: T,
    actionParams: OneBotActions[T][0]
  ): Promise<OneBotActions[T][1]>;

  listen<T extends keyof OneBotEvents>(
    eventName: T,
    callback: (eventDetail: OneBotEvents[T]) => void
  ): number;

  removeListener(listenerId: number): void;
}

export { Arona };
