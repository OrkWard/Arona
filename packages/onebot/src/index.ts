import type { OneBotActionRequest, OneBotActionResponse, OneBotActions } from "./action.js";
import type { OneBotEvent, OneBotMessageEvent } from "./event.js";
import WebSocket from "ws";
import assert from "assert";
import { throttle } from "./utils/index.js";
import { pino, Logger } from "pino";

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
  // Event response timeout, in millisecond
  // timeout: number = 10_000;
  logger?: Logger;
};

type EventCallback = (event: OneBotEvent) => void;

class OneBot {
  private ws: WebSocket;
  private logger: Logger;
  private listeners: Map<string, Map<number, EventCallback>> = new Map();
  private receiveQueue: Map<string, OneBotActionResponse> = new Map();
  /** Only use when connection not ready  */
  private sendQueue: string[] = [];

  constructor(config: OneBotConfig) {
    const ws = new WebSocket(`ws://${config.origin}`, {
      headers: { authorization: `Bearer ${config.authKey}` },
    });
    this.ws = ws;
    this.logger = config.logger ?? pino();
    ws.on("error", (err) => {
      this.logger.error(err);
    });
    ws.once("open", () => {
      this.logger.info("Connected to", config.origin);
      this.sendQueue.forEach((msg) => {
        ws.send(msg);
        this.logger.debug(`Msg in queue sent: ${msg}`);
      });
    });

    ws.on("message", (message) => {
      assert(message instanceof Buffer, "In default message should be Node native buffer");

      const parsedMsg = JSON.parse(message.toString("utf8"));
      if (isActionResponse(parsedMsg)) {
        this.logger.debug(`Receive action response: ${JSON.stringify(parsedMsg)}`);
        assert(typeof parsedMsg.echo === "string", `Action Response should have 'echo': ${JSON.stringify(parsedMsg)}`);
        const id = parsedMsg.echo;
        this.receiveQueue.set(id, parsedMsg);
      } else if (isEvent(parsedMsg)) {
        this.logger.debug(`Receive event: ${JSON.stringify(parsedMsg)}`);
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

  /**
   * @throws OneBotError
   */
  post<T extends keyof OneBotActions>(actionName: T, actionParams: OneBotActions[T][0]) {
    const echo = (requestCounter++).toString();
    const payload = JSON.stringify({
      action: actionName,
      params: actionParams,
      echo: echo.toString(),
    } satisfies OneBotActionRequest);

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      this.logger.debug(`Action sent: ${payload}`);
    } else {
      this.sendQueue.push(payload);
      this.logger.debug(`Action queued: ${payload}`);
    }

    return new Promise<OneBotActions[T][1]>((resolve, reject) => {
      const intervalId = setInterval(() => {
        const res = this.receiveQueue.get(echo);
        if (res) {
          if (res.status === "ok") {
            this.logger.debug(`Action Return: ${JSON.stringify(res)}`);
            resolve(res.data);
          } else if (res.status === "failed") {
            this.logger.debug(`Action Error: ${JSON.stringify(res)}`);
            reject(new OneBotError(`[${res.retcode}] ` + res.message));
          }
          this.receiveQueue.delete(echo);
          clearInterval(intervalId);
        }
      }, 200);
    });
  }

  /**
   * @throws ThrottleError
   */
  sendPrivateMsg = throttle(
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

  onOpen(callback: () => void) {
    this.ws.on("open", callback);
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
