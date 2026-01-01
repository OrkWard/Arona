import WebSocket from "ws";
import { pino, Logger } from "pino";
import type { OneBotActionRequest, OneBotActionResponse, OneBotActions } from "./action.js";
import type { OneBotEvent, OneBotMessageEvent } from "./event.js";
import { throttle } from "./utils/index.js";

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

type EventCallback = (event: OneBotEvent) => void;
type ExtractEvent<U extends { post_type: string }, TType extends string> = U extends { post_type: TType } ? U : never;

/**
 * When created, this class create a connection to onebot server immediately,
 * and try to reconnect when close unexpectedly.
 *
 * this class expose two main interfaces:
 * 1. message listener. For each OneBot event type, it manage a list of listeners,
 *    exec them one by one when receving message. It also allow remove listener by
 *    passing the id return by `on` function.
 * 2. send action. When calling the `send` function, it will try to send the action
 *    immediately if the connection is ready, and simply drop if not. But it won't
 *    resolve until receving the message with the same id it send in the action.
 *
 * TODO: Implment send action global default timeout time
 * TODO: Allow several retry before drop send task when connection is not ready
 */
class OneBot {
  private ws!: WebSocket;
  private reconncetTimer: NodeJS.Timeout | null = null;
  private shouldClose = false;

  private listeners: Map<string, Map<number, EventCallback>> = new Map();
  private listenerCounter = 0;

  private receiveQueue: Map<string, OneBotActionResponse> = new Map();
  private requestCounter = 0;

  private connect() {
    const ws = new WebSocket(this.address, {
      headers: { authorization: `Bearer ${this.authKey}` },
    });

    ws.on("error", (err) => {
      this.logger.error(err);
      ws.close();
    });
    ws.once("open", () => {
      if (this.reconncetTimer) clearTimeout(this.reconncetTimer);

      this.logger.info(`Connected to ${this.address}`);
    });
    ws.on("close", () => {
      this.logger.warn(`Connection closed. Reconnecting 5 seconds...`);
      if (!this.shouldClose) this.reconnect();
    });
    ws.on("message", (message) => {
      if (!(message instanceof Buffer)) {
        this.logger.warn("Expect ws message as buffer");
        return;
      }

      const parsedMsg = JSON.parse(message.toString("utf8"));

      if (isActionResponse(parsedMsg)) {
        this.logger.debug(`Receive action response: ${JSON.stringify(parsedMsg)}`);
        if (typeof parsedMsg.echo !== "string") {
          this.logger.warn(`Action Response should have 'echo': ${JSON.stringify(parsedMsg)}`);
          return;
        }

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

    this.ws = ws;
  }

  private reconnect() {
    if (this.reconncetTimer) clearTimeout(this.reconncetTimer);

    this.reconncetTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  constructor(
    private address: string,
    private authKey: string,
    private logger: Logger = pino()
  ) {
    this.connect();
  }

  /**
   * @throws OneBotError
   */
  post<T extends keyof OneBotActions>(actionName: T, actionParams: OneBotActions[T][0]) {
    const echo = (this.requestCounter++).toString();
    const payload = JSON.stringify({
      action: actionName,
      params: actionParams,
      echo: echo.toString(),
    } satisfies OneBotActionRequest);

    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      this.logger.debug(`Action sent: ${payload}`);
    } else {
      this.logger.warn("Message dropped");
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

  on<T extends OneBotEvent["post_type"]>(
    eventName: T,
    callback: (event: ExtractEvent<OneBotEvent, T>) => void
  ): number {
    if (this.listeners.get(eventName)) {
      this.listeners.get(eventName)?.set(this.listenerCounter, callback as EventCallback);
    } else {
      this.listeners.set(eventName, new Map([[this.listenerCounter, callback as EventCallback]]));
    }

    return this.listenerCounter++;
  }

  onMessage(callback: (event: OneBotMessageEvent) => void): number {
    return this.on("message", callback);
  }

  removeListener(eventName: OneBotEvent["post_type"], listenerId: number) {
    this.listeners.get(eventName)?.delete(listenerId);
  }

  close() {
    this.shouldClose = true;
    this.ws.close();
  }
}

export { OneBot, Logger };
export type { OneBotEvent, OneBotActions };
export type { Message, MessageSegment } from "./message.js";
