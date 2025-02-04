import type { OneBotActionRequest, OneBotActionResponse, OneBotActions } from "./action.js";
import type { OneBotEvent, OneBotEventBase, OneBotMessageEvent, OneBotMetaEvent } from "./event.js";
import WebSocket from "ws";
import { Logger } from "./utils/log.js";
import assert from "assert";
import { ResultAsync } from "neverthrow";
import { throttleAsync } from "./utils/nt.js";

let listenerCounter = 0;
let requestCounter = 0;

function isActionResponse(message: any): message is OneBotActionResponse {
  return "retcode" in message;
}

function isEvent(message: any): message is OneBotEvent {
  return "post_type" in message;
}

export class OneBotError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OneBotError";
  }
}

type OneBotConfig = {
  origin: string;
  authKey: string;
  logger?: {
    silent?: boolean;
    debug?: boolean;
  };
  // Event response timeout, in millisecond
  // timeout: number = 10_000;
};

type EventCallback = (event: OneBotEvent) => void;

class OneBot {
  private ws: WebSocket;
  private listeners: Map<string, Map<number, EventCallback>> = new Map();
  private messageBuffer: Map<string, OneBotActionResponse> = new Map();

  constructor(
    private logger: Logger,
    config: OneBotConfig
  ) {
    const ws = new WebSocket(`ws://${config.origin}`, {
      headers: { authorization: `Bearer ${config.authKey}` },
    });
    this.ws = ws;
    ws.on("error", (err) => {
      logger.error(err);
    });
    ws.on("open", () => {
      logger.info("Connected to", config.origin);
    });

    ws.on("message", (message) => {
      assert(message instanceof Buffer, "In default message should be Node native buffer");

      const parsedMsg = JSON.parse(message.toString("utf8"));
      if (isActionResponse(parsedMsg)) {
        logger.debug(`Receive action response: ${JSON.stringify(parsedMsg)}`);
        assert(typeof parsedMsg.echo === "string", `Action Response should have 'echo': ${JSON.stringify(parsedMsg)}`);
        const id = parsedMsg.echo;
        this.messageBuffer.set(id, parsedMsg);
      } else if (isEvent(parsedMsg)) {
        logger.debug(`Receive event: ${JSON.stringify(parsedMsg)}`);
        const eventName = parsedMsg.post_type;
        const listeners = this.listeners.get(eventName);
        if (listeners) {
          listeners.forEach((callback) => {
            callback(parsedMsg);
          });
        }
      }
    });
  }

  post<T extends keyof OneBotActions>(actionName: T, actionParams: OneBotActions[T][0]) {
    const echo = (requestCounter++).toString();
    const payload = JSON.stringify({
      action: actionName,
      params: actionParams,
      echo: echo.toString(),
    } satisfies OneBotActionRequest);

    this.ws.send(payload);
    this.logger.debug(`Action Sent: ${payload}`);

    return ResultAsync.fromPromise(
      new Promise<OneBotActions[T][1]>((resolve, reject) => {
        const intervalId = setInterval(() => {
          const res = this.messageBuffer.get(echo);
          if (res) {
            if (res.status === "ok") {
              this.logger.debug(`Action Return: ${JSON.stringify(res)}`);
              resolve(res.data);
            } else if (res.status === "failed") {
              this.logger.debug(`Action Error: ${JSON.stringify(res)}`);
              reject(new OneBotError(`[${res.retcode}] ` + res.message));
            }
            this.messageBuffer.delete(echo);
            clearInterval(intervalId);
          }
        }, 200);
      }),
      (e) => {
        if (e instanceof OneBotError) {
          return e;
        } else {
          return new OneBotError(`Unknown Error: ${Error.prototype.toString.call(e)}`);
        }
      }
    );
  }

  sendPrivateMsg = throttleAsync(
    (params: OneBotActions["send_private_msg"][0]) => this.post("send_private_msg", params),
    3000
  );

  _on(eventName: string, callback: EventCallback): number {
    if (this.listeners.get(eventName)) {
      this.listeners.get(eventName)?.set(listenerCounter, callback);
    } else {
      this.listeners.set(eventName, new Map([[listenerCounter, callback]]));
    }

    return listenerCounter++;
  }

  onMessage(callback: (event: OneBotMessageEvent) => void): number {
    return this._on("message", callback as EventCallback);
  }

  removeListener(eventName: string, listenerId: number) {
    this.listeners.get(eventName)?.delete(listenerId);
  }

  close() {
    this.ws.close();
  }
}

export { OneBot, Logger };
export type { OneBotEvent, OneBotActions };
export type { Message, MessageSegment } from "./message.js";
