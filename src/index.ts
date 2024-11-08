import type {
  OneBotActionRequest,
  OneBotActionResponse,
  OneBotActions,
} from "./action.ts";
import type { OneBotEvents } from "./event.ts";
import WebSocket from "ws";
import util from "node:util";

let listenerCounter = 0;
let requestCounter = 0;

const decoder = new util.TextDecoder();

class Arona {
  ws: WebSocket;
  listeners: Map<
    string,
    Map<number, (eventDetail: OneBotEvents[keyof OneBotEvents]) => void>
  >;
  // Only store action response here. Event will be handle or throw away when
  // receiving
  messageBuffer: (OneBotActionResponse | undefined)[] = [];
  // Event response timeout, in millisecond
  timeout: number = 10_000;

  constructor(host: string, config?: { timeout?: number }) {
    const ws = new WebSocket(`ws://${host}`);
    this.ws = ws;
    ws.on("error", console.error);
    ws.on("open", () => {
      console.log("connected");
    });

    ws.on("message", (message) => {
      if (Array.isArray(message)) {
        throw message;
      }
      const decodedMsg = decoder.decode(message);
      const parsedMsg = JSON.parse(decodedMsg);
      if (parsedMsg.status) {
        this.messageBuffer.push(parsedMsg);
      } else {
        const eventName = parsedMsg.type;
        const listeners = this.listeners.get(eventName);
        if (listeners) {
          listeners.forEach((callback) => {
            callback(parsedMsg);
          });
        }
      }
    });

    this.listeners = new Map();
  }

  request<T extends keyof OneBotActions>(
    actionName: T,
    actionParams: OneBotActions[T][0]
  ): Promise<OneBotActions[T][1]> {
    const echo = (requestCounter++).toString();
    this.ws.send(
      JSON.stringify({
        action: actionName,
        param: actionParams,
        echo: echo.toString(),
      } satisfies OneBotActionRequest)
    );

    return new Promise((resolve) => {
      const intervalId = setInterval(() => {
        this.messageBuffer
          .filter((res) => !!res)
          .forEach((res, i) => {
            if (res.echo === echo) {
              // @ts-expect-error
              resolve(res.data);
              this.messageBuffer[i] = undefined;
              clearInterval(intervalId);
            }
          });
      }, 200);
    });
  }

  listen<T extends keyof OneBotEvents>(
    eventName: T,
    callback: (eventDetail: OneBotEvents[T]) => void
  ): number {
    if (this.listeners.get(eventName)) {
      this.listeners.set(eventName, new Map([[listenerCounter, callback]]));
    } else {
      const eventListeners = this.listeners.get(eventName)!;
      eventListeners.set(listenerCounter, callback);
    }

    return listenerCounter++;
  }

  removeListener(eventName: string, listenerId: number) {
    if (!this.listeners.get(eventName)) {
      return;
    }

    this.listeners.get(eventName)!.delete(listenerId);
  }
}

export { Arona };
