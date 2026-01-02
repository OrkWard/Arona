import { Effect } from "effect";
import { OneBotEvent } from "onebot";
import { Schema } from "effect";

export const PluginStatus = Schema.Literal("inactive", "init", "running", "stopped", "error");
export type PluginStatus = Schema.Schema.Type<typeof PluginStatus>;

export const PluginMeta = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal("cron", "command"),
});
export type PluginMeta = Schema.Schema.Type<typeof PluginMeta>;

// Only command type
export const Command = Schema.Struct({
  pattern: Schema.String, // support regexp
  description: Schema.optional(Schema.String),
});
export type Command = Schema.Schema.Type<typeof Command>;

export abstract class Plugin {
  constructor(
    public readonly meta: PluginMeta,
    public status: PluginStatus = "init"
  ) {}

  init(): Effect.Effect<void> {
    return Effect.void;
  }
  abstract start(): Effect.Effect<void>;
  abstract stop(): Effect.Effect<void>;
  abstract destroy(): Effect.Effect<void>;

  onEvent(event: OneBotEvent): Effect.Effect<void> {
    return Effect.void;
  }
}
