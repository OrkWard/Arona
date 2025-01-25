import type { OneBotActionRequest, OneBotActionResponse, OneBotActions } from "./action.js";
import type { OneBotEvent } from "./event.js";
import WebSocket from "ws";
import { Logger } from "../service/log.js";
import assert from "assert";
import { Service } from "typedi";
import { AppConfig } from "../service/app.js";

let listenerCounter = 0;
let requestCounter = 0;

function isActionResponse(message: any): message is OneBotActionResponse {
  return Boolean(message.retcode);
}

function isEvent(message: any): message is OneBotEvent {
  return Boolean(message.post_type);
}

@Service()
class OneBot {
  private ws: WebSocket;
  private listeners: Map<string, Map<number, (event: OneBotEvent) => void>> = new Map();
  // Only store action response here. Event will be handle or throw away when
  // receiving
  private messageBuffer: Map<string, OneBotActionResponse> = new Map();

  constructor(
    private logger: Logger,
    private app: AppConfig
  ) {
    const ws = new WebSocket(`ws://${app.config.origin}`, {
      headers: { authorization: `Bearer ${app.config.authKey}` },
    });
    this.ws = ws;
    ws.on("error", (err) => {
      logger.error(err);
    });
    ws.on("open", () => {
      logger.info("Connected to", app.config.origin);
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
        const res = this.messageBuffer.get(echo);
        if (res) {
          resolve(res.data);
          this.messageBuffer.delete(echo);
          clearInterval(intervalId);
        }
      }, 200);
    });
  }

  addListener<T extends OneBotEvent["post_type"]>(eventName: T, callback: (event: OneBotEvent) => void): number {
    if (this.listeners.get(eventName)) {
      const eventListeners = this.listeners.get(eventName)!;
      eventListeners.set(listenerCounter, callback);
    } else {
      this.listeners.set(eventName, new Map([[listenerCounter, callback]]));
    }

    return listenerCounter++;
  }

  removeListener(eventName: string, listenerId: number) {
    this.listeners.get(eventName)?.delete(listenerId);
  }

  close() {
    this.ws.close();
  }
}

export { OneBot };
