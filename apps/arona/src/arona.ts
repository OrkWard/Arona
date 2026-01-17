import { Effect, Layer, Schedule, Duration, Fiber } from "effect";
import { createClient } from "redis";
import Koa from "koa";
import { send } from "@koa/send";
import { OneBot } from "onebot";
import { RedisService, MediaService, OneBotService, WormfaceService } from "./services/index.js";
import { logger } from "./util/logger.js";
import type { EventPlugin, CronPlugin } from "./types.js";

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
  private layer: Layer.Layer<RedisService | MediaService | OneBotService | WormfaceService, never, never>;

  private eventPlugins = new Map<string, { plugin: EventPlugin; enabled: boolean }>();
  private cronPlugins = new Map<
    string,
    { plugin: CronPlugin; enabled: boolean; fiber: Fiber.RuntimeFiber<unknown, unknown> | null }
  >();

  constructor(config: AronaConfig) {
    this.onebot = new OneBot(config.onebotOrigin, config.onebotAuthToken, logger);

    const redisClient = createClient({ url: config.redisUrl });
    redisClient.on("error", (err) => logger.error({ msg: "Redis error", error: err }));

    // Create static/media server
    const app = new Koa();
    app.use(async (ctx) => {
      if (ctx.path.startsWith("/assets/")) {
        await send(ctx, ctx.path.replace("/assets/", ""), { root: config.assetsDir });
      } else {
        ctx.status = 404;
      }
    });
    app.listen(config.serverPort, () => {
      logger.info({ msg: "Media server started", port: config.serverPort });
    });

    // Build layer with all services
    this.layer = Layer.mergeAll(
      RedisService.makeLive(redisClient),
      MediaService.makeLive({
        assetsDir: config.assetsDir,
        baseUrl: config.baseUrl,
      }),
      OneBotService.makeLive(this.onebot),
      WormfaceService.makeLive(config.wormfaceOrigin)
    );

    // Connect Redis
    redisClient.connect().then(() => {
      logger.info("Redis connected");
    });
  }

  add(name: string, plugin: EventPlugin) {
    this.eventPlugins.set(name, { plugin, enabled: true });
    logger.info({ msg: "Event plugin registered", name });
  }

  cron(name: string, plugin: CronPlugin) {
    this.cronPlugins.set(name, { plugin, enabled: true, fiber: null });
    logger.info({ msg: "Cron plugin registered", name, interval: plugin.interval });
  }

  enable(name: string) {
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

  disable(name: string) {
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

  start() {
    // Start OneBot WebSocket connection
    this.onebot.start();

    // Register event dispatchers (once per event type)
    this.onebot.on("message", (event) => this.dispatchEvent("onMessage", event));
    this.onebot.on("notice", (event) => this.dispatchEvent("onNotice", event));
    this.onebot.on("meta_event", (event) => this.dispatchEvent("onMeta", event));

    // Start all enabled cron plugins
    for (const [name, entry] of this.cronPlugins) {
      if (entry.enabled) {
        this.startCronFiber(name, entry);
      }
    }

    logger.info("Arona started");
  }

  private dispatchEvent(method: "onMessage" | "onNotice" | "onMeta", event: unknown) {
    for (const [name, { plugin, enabled }] of this.eventPlugins) {
      const handler = plugin[method];
      if (!enabled || !handler) continue;

      this.runEffect(handler(event as any), name);
    }
  }

  private startCronFiber(
    name: string,
    entry: { plugin: CronPlugin; enabled: boolean; fiber: Fiber.RuntimeFiber<unknown, unknown> | null }
  ) {
    const scheduled = entry.plugin.task().pipe(
      Effect.catchAll((e) => Effect.sync(() => logger.error({ msg: "Cron task error", plugin: name, error: e }))),
      Effect.repeat(Schedule.spaced(Duration.millis(entry.plugin.interval))),
      Effect.provide(this.layer as Layer.Layer<any, never, never>),
      Effect.catchAllCause(() => Effect.void)
    );

    entry.fiber = Effect.runFork(scheduled);
    logger.info({ msg: "Cron fiber started", name });
  }

  private runEffect(effect: Effect.Effect<void, unknown, unknown>, pluginName: string) {
    Effect.runPromise(
      effect.pipe(
        Effect.provide(this.layer as Layer.Layer<any, never, never>),
        Effect.catchAll((e) => Effect.sync(() => logger.error({ msg: "Plugin error", plugin: pluginName, error: e }))),
        Effect.catchAllCause(() => Effect.void)
      )
    );
  }
}
