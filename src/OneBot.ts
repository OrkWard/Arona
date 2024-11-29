import type {
  OneBotActionRequest,
  OneBotActionResponse,
  OneBotActions,
} from "./action.js";
import type { OneBotEvent, OneBotEvents } from "./event.js";
import WebSocket from "ws";
import { Logger } from "./log.js";

let listenerCounter = 0;
let requestCounter = 0;

const logger = new Logger({ debug: true });

function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isEvent(message: any): message is OneBotEvent {
  return Boolean(message.id);
}

class OneBot {
  ws: WebSocket;
  listeners: Map<string, Map<number, (event: OneBotEvent) => void>>;
  // Only store action response here. Event will be handle or throw away when
  // receiving
  messageBuffer: (OneBotActionResponse | undefined)[] = [];
  // Event response timeout, in millisecond
  timeout: number = 10_000;

  constructor(host: string, config?: { timeout?: number }) {
    const ws = new WebSocket(`ws://${host}`);
    this.ws = ws;
    ws.on("error", (err) => {
      logger.error(err);
    });
    ws.on("open", () => {
      logger.info("Connected to", host);
    });

    ws.on("message", (message) => {
      assert(
        message instanceof Buffer,
        "In default message should be Node native buffer"
      );

      logger.info("receive message");

      const parsedMsg = JSON.parse(message.toString("utf8"));
      if (isEvent(parsedMsg)) {
        const eventName = parsedMsg.type;
        const listeners = this.listeners.get(eventName);
        if (listeners) {
          listeners.forEach((callback) => {
            callback(parsedMsg);
          });
        }
      } else {
        this.messageBuffer.push(parsedMsg);
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
    callback: (event: OneBotEvent) => void
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
    this.listeners.get(eventName)?.delete(listenerId);
  }
}

export { OneBot as Arona };
