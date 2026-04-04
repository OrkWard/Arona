import { Effect, Layer, Exit, Cause } from "effect";
import * as Sentry from "@sentry/node";
import { NodeContext, NodeFileSystem } from "@effect/platform-node";
import { createClient } from "redis";
import cron, { type ScheduledTask } from "node-cron";

import { OneBot, OneBotMessageEvent, OneBotNoticeEvent, OneBotMetaEvent } from "onebot";
import { RedisService, S3Service, OneBotService, WormfaceService, MlService, DbService } from "./services/index.js";
import { RedisClient } from "./services/redis.js";
import { logger } from "./util/logger.js";
import type { EventPlugin, CronPlugin, Services } from "./types.js";

export interface AronaConfig {
  // OneBot
  onebotOrigin: string;
  onebotAuthToken: string;
  adminId: number;

  // Target groups (bot only processes messages from these groups)
  groupId: number | number[];

  // Redis
  redisUrl: string;

  // S3 server
  s3Endpoint: string;
  s3Ak: string;
  s3Sk: string;

  // Wormface
  wormfaceOrigin: string;

  // Arona-Machine-Learning
  mlOrigin: string;

  // MongoDB
  mongoUrl: string;
}

export class Arona {
  private onebot: OneBot;
  private redis: RedisClient;
  private layer: Layer.Layer<Services, never, never>;

  private eventPlugins = new Map<string, { plugin: EventPlugin; enabled: boolean }>();
  private cronPlugins = new Map<string, { plugin: CronPlugin; enabled: boolean; task: ScheduledTask | null }>();

  constructor(private config: AronaConfig) {
    this.onebot = new OneBot(config.onebotOrigin, config.onebotAuthToken, logger.child({ module: "onebot" }));
    this.redis = (() => {
      const client = createClient({ url: config.redisUrl });
      client.on("error", (err) => logger.error({ msg: "Redis error", error: err }));
      client.connect().then(() => {
        logger.info("Redis connected");
      });
      return client;
    })();

    this.layer = Layer.mergeAll(
      RedisService.makeLive(this.redis),
      S3Service.makeLive({
        endpoint: config.s3Endpoint,
        ak: config.s3Ak,
        sk: config.s3Sk,
        mediaBucket: "media",
        stickerBucket: "sticker",
      }),
      OneBotService.makeLive(this.onebot),
      WormfaceService.makeLive(config.wormfaceOrigin),
      MlService.makeLive(config.mlOrigin),
      DbService.makeLive(config.mongoUrl),
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
    if (!cron.validate(plugin.cron)) {
      throw new Error(`Invalid cron expression for plugin ${name}: ${plugin.cron}`);
    }
    this.cronPlugins.set(name, { plugin, enabled, task: null });
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
        this.startCronTask(name, entry);
      }
    }
  }

  /** Dispatch message to plugin. If this is a switch command, don't dispatch. */
  private handleMessage(event: OneBotMessageEvent) {
    logger.debug({ msg: "Received onebot message", content: JSON.stringify(event) });

    // Only process messages from the target groups
    const allowedGroups = Array.isArray(this.config.groupId) ? this.config.groupId : [this.config.groupId];
    if (event.message_type !== "group" || !allowedGroups.includes(event.group_id)) {
      return;
    }

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
      this.startCronTask(name, cronEntry);
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
      if (cronEntry.task) {
        cronEntry.task.stop();
      }
      logger.info({ msg: "Cron plugin disabled", name });
    }
  }

  private startCronTask(name: string, entry: { plugin: CronPlugin; enabled: boolean; task: ScheduledTask | null }) {
    if (entry.task) {
      entry.task.start();
      logger.info({ msg: "Cron task started", name, cron: entry.plugin.cron });
      return;
    }

    entry.task = cron.schedule(entry.plugin.cron, () => {
      void this.runEffect(entry.plugin.task, name);
    });
    logger.info({ msg: "Cron task scheduled", name, cron: entry.plugin.cron });
  }

  private runEffect(effect: Effect.Effect<void, Error, Services>, pluginName: string) {
    void Effect.runPromiseExit(effect.pipe(Effect.provide(this.layer))).then((exit) => {
      if (Exit.isFailure(exit)) {
        const cause = exit.cause;
        const pretty = Cause.pretty(cause);

        logger.error({
          msg: "Plugin error",
          plugin: pluginName,
          error: pretty,
        });

        Sentry.withScope((scope) => {
          scope.setTag("plugin", pluginName);
          scope.setExtra("fullCause", pretty);
          Sentry.captureException(cause);
        });
      }
    });
  }
}
