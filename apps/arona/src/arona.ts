import { Effect, Layer, Schedule, Duration, Fiber } from "effect";
import { createClient } from "redis";
import Koa from "koa";
import { send } from "@koa/send";
import { OneBot, OneBotMessageEvent, OneBotNoticeEvent, OneBotMetaEvent } from "onebot";
import { RedisService, MediaService, OneBotService, WormfaceService } from "./services/index.js";
import { logger } from "./util/logger.js";
import type { EventPlugin, CronPlugin, Services } from "./types.js";
import { NodeContext } from "@effect/platform-node";

export interface AronaConfig {
  // OneBot
  onebotOrigin: string;
  onebotAuthToken: string;

  // Redis
  redisUrl: string;

  // Media server
  assetsDir: string;
  serverPort: number;
  baseUrl: string;

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
    this.setupStatic();

    this.layer = Layer.mergeAll(
      RedisService.makeLive(this.setupRedis()),
      MediaService.makeLive({
        assetsDir: config.assetsDir,
        baseUrl: config.baseUrl,
      }),
      OneBotService.makeLive(this.onebot),
      WormfaceService.makeLive(config.wormfaceOrigin),
      NodeContext.layer
    );
  }

  add(name: string, plugin: EventPlugin) {
    this.eventPlugins.set(name, { plugin, enabled: true });
  }

  cron(name: string, plugin: CronPlugin) {
    this.cronPlugins.set(name, { plugin, enabled: true, fiber: null });
  }

  start() {
    this.onebot.start();
    this.onebot.on("message", (event) => this.handleMessage(event));
    this.onebot.on("notice", (event) => this.handleNotice(event));
    this.onebot.on("meta_event", (event) => this.handleMeta(event));

    for (const [name, entry] of this.cronPlugins) {
      if (entry.enabled) {
        this.startCronFiber(name, entry);
      }
    }

    logger.info("Arona started");
  }

  private setupStatic() {
    const app = new Koa();
    app.use(async (ctx) => {
      if (ctx.path.startsWith("/assets/")) {
        await send(ctx, ctx.path.replace("/assets/", ""), { root: this.config.assetsDir });
      } else {
        ctx.status = 404;
      }
    });
    app.listen(this.config.serverPort, () => {
      logger.info({ msg: "Media server started", port: this.config.serverPort });
    });
  }

  private setupRedis() {
    const client = createClient({ url: this.config.redisUrl });
    client.on("error", (err) => logger.error({ msg: "Redis error", error: err }));
    client.connect().then(() => {
      logger.info("Redis connected");
    });
    return client;
  }

  private handleMessage(event: OneBotMessageEvent) {
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
      Effect.catchAll((e) => Effect.sync(() => logger.error({ msg: "Cron task error", plugin: name, error: e }))),
      Effect.repeat(Schedule.spaced(Duration.millis(entry.plugin.interval)))
    );

    entry.fiber = Effect.runFork(scheduled);
    logger.info({ msg: "Cron fiber started", name });
  }

  private runEffect(effect: Effect.Effect<void, unknown, Services>, pluginName: string) {
    Effect.runPromise(
      effect.pipe(
        Effect.provide(this.layer),
        Effect.catchAll((e) => Effect.sync(() => logger.error({ msg: "Plugin error", plugin: pluginName, error: e })))
      )
    );
  }
}
