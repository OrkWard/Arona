import { Effect, pipe, Schedule } from "effect";
import { Plugin, PluginMeta, PluginStatus } from "./base.js";

export interface Config {
  cron: string;
  immediate?: boolean;
}

export abstract class CronPlugin extends Plugin {
  constructor(
    meta: PluginMeta,
    status: PluginStatus,
    private readonly config: Config
  ) {
    super(meta, status);
  }

  start(): Effect.Effect<void> {
    return pipe(Effect.schedule(this.execute(), Schedule.cron(this.config.cron)), Effect.forkDaemon);
  }

  stop(): Effect.Effect<void> {
    return Effect.void;
  }

  protected abstract execute(): Effect.Effect<void>;
}
