import { Effect, Layer, Schedule, Duration, Fiber } from "effect";
import { NodeContext, NodeFileSystem } from "@effect/platform-node";
import { createClient } from "redis";

import { OneBot, OneBotMessageEvent, OneBotNoticeEvent, OneBotMetaEvent } from "onebot";
import { RedisService, S3Service, OneBotService, WormfaceService } from "./services/index.js";
import { logger } from "./util/logger.js";
import type { EventPlugin, CronPlugin, Services } from "./types.js";

export interface AronaConfig {
  // OneBot
  onebotOrigin: string;
  onebotAuthToken: string;
  adminId: number;

  // Redis
  redisUrl: string;

  // S3 server
  s3Endpoint: string;
  s3Ak: string;
  s3Sk: string;

  // Wormface
  wormfaceOrigin: string;
}

export class Arona {
  private onebot: OneBot;
  private layer: Layer.Layer<Services, never, never>;

  private eventPlugins = new Map<string, { plugin: EventPlugin; enabled: boolean }>();
  private cronPlugins = new Map<
    string,
    { plugin: CronPlugin; enabled: boolean; fiber: Fiber.RuntimeFiber<unknown, unknown> | null }
  >();

  constructor(private config: AronaConfig) {
    this.onebot = new OneBot(config.onebotOrigin, config.onebotAuthToken, logger);

    this.layer = Layer.mergeAll(
      RedisService.makeLive(this.setupRedis()),
      S3Service.makeLive({
        endpoint: config.s3Endpoint,
        ak: config.s3Ak,
        sk: config.s3Sk,
        mediaBucket: "media",
        stickerBucket: "sticker",
      }),
      OneBotService.makeLive(this.onebot),
      WormfaceService.makeLive(config.wormfaceOrigin),
      NodeContext.layer
    )
      .pipe(Layer.provide(NodeFileSystem.layer))
      .pipe(Layer.orDie);
  }

  /** add event plugin */
  add(name: string, plugin: EventPlugin, enabled = true) {
    this.eventPlugins.set(name, { plugin, enabled });
  }

  /** add cron plugin */
  cron(name: string, plugin: CronPlugin, enabled = true) {
    this.cronPlugins.set(name, { plugin, enabled, fiber: null });
  }

  /** Start handle onebot event and cronjob. Should only call once. */
  start() {
    this.onebot.start();
    // TODO: we don't have stop() so ignore the return id
    this.onebot.on("message", (event) => this.handleMessage(event));
    this.onebot.on("notice", (event) => this.handleNotice(event));
    this.onebot.on("meta_event", (event) => this.handleMeta(event));
    logger.info("Arona started");

    for (const [name, entry] of this.cronPlugins) {
      if (entry.enabled) {
        this.startCronFiber(name, entry);
      }
    }
  }

  /** Setup redis client. Since this is just a client it could be called multiple times.
   * @returns client object
   */
  private setupRedis() {
    const client = createClient({ url: this.config.redisUrl });
    client.on("error", (err) => logger.error({ msg: "Redis error", error: err }));
    client.connect().then(() => {
      logger.info("Redis connected");
    });
    return client;
  }

  /** Dispatch message to plugin. If this is a switch command, don't dispatch. */
  private handleMessage(event: OneBotMessageEvent) {
    const text = event.message?.[0].type === "text" ? event.message[0].data.text : "";
    const sender = event.sender.user_id;
    const switchMatchResult = text.match(/^\/(on|off) (\w+)$/);
    if (switchMatchResult && sender === this.config.adminId) {
      const [_, command, pluginName] = switchMatchResult as [string, "on" | "off", string];
      logger.info(`admin command targetStatus=${command} plugin=${pluginName}`);
      switch (command) {
        case "on":
          this.enable(pluginName);
          break;
        case "off":
          this.disable(pluginName);
          break;
      }
      return;
    }

    for (const [name, { plugin, enabled }] of this.eventPlugins) {
      if (!enabled || !plugin.onMessage) continue;
      this.runEffect(plugin.onMessage(event), name);
    }
  }

  private handleNotice(event: OneBotNoticeEvent) {
    for (const [name, { plugin, enabled }] of this.eventPlugins) {
      if (!enabled || !plugin.onNotice) continue;
      this.runEffect(plugin.onNotice(event), name);
    }
  }

  private handleMeta(event: OneBotMetaEvent) {
    for (const [name, { plugin, enabled }] of this.eventPlugins) {
      if (!enabled || !plugin.onMeta) continue;
      this.runEffect(plugin.onMeta(event), name);
    }
  }

  private enable(name: string) {
    const eventEntry = this.eventPlugins.get(name);
    if (eventEntry) {
      eventEntry.enabled = true;
      logger.info({ msg: "Event plugin enabled", name });
      return;
    }

    const cronEntry = this.cronPlugins.get(name);
    if (cronEntry) {
      cronEntry.enabled = true;
      if (!cronEntry.fiber) {
        this.startCronFiber(name, cronEntry);
      }
      logger.info({ msg: "Cron plugin enabled", name });
    }
  }

  private disable(name: string) {
    const eventEntry = this.eventPlugins.get(name);
    if (eventEntry) {
      eventEntry.enabled = false;
      logger.info({ msg: "Event plugin disabled", name });
      return;
    }

    const cronEntry = this.cronPlugins.get(name);
    if (cronEntry) {
      cronEntry.enabled = false;
      if (cronEntry.fiber) {
        Effect.runFork(Fiber.interrupt(cronEntry.fiber));
        cronEntry.fiber = null;
      }
      logger.info({ msg: "Cron plugin disabled", name });
    }
  }

  private startCronFiber(
    name: string,
    entry: { plugin: CronPlugin; enabled: boolean; fiber: Fiber.RuntimeFiber<unknown, unknown> | null }
  ) {
    const scheduled = entry.plugin.task.pipe(
      Effect.provide(this.layer),
      Effect.catchAll((e) =>
        Effect.sync(() => logger.error({ msg: "Cron task error", plugin: name, error: e.message }))
      ),
      Effect.schedule(Schedule.spaced(Duration.millis(entry.plugin.interval)))
    );

    entry.fiber = Effect.runFork(scheduled);
    logger.info({ msg: "Cron fiber started", name });
  }

  private runEffect(effect: Effect.Effect<void, Error, Services>, pluginName: string) {
    Effect.runPromise(
      effect.pipe(
        Effect.provide(this.layer),
        Effect.catchAll((e) =>
          Effect.sync(() => logger.error({ msg: "Plugin error", plugin: pluginName, error: e.message }))
        )
      )
    );
  }
}
