import { Effect, Ref, Option, Layer, HashMap, Context, pipe } from "effect";
import { Plugin, PluginStatus } from "../plugin/base.js";
import { OneBotEvent } from "onebot";

export class PluginSystem extends Context.Tag("PluginSystem")<
  PluginSystem,
  {
    load(plugin: Plugin): Effect.Effect<void>;
    start(pluginId: string): Effect.Effect<void, unknown>;
    stop(pluginId: string): Effect.Effect<void, unknown>;

    get(pluginId: string): Effect.Effect<Option.Option<Plugin>>;
    list(): Effect.Effect<Array<Plugin>>;

    dispatch(event: OneBotEvent): Effect.Effect<void>;
  }
>() {}

export const PluginSystemLive = Layer.effect(
  PluginSystem,
  Effect.gen(function* () {
    const plugins = yield* Ref.make(HashMap.empty<string, Plugin>());

    const updateStatus = (id: string, status: PluginStatus) =>
      Ref.update(plugins, (map) =>
        HashMap.modify(map, id, (plugin) => {
          plugin.status = status;
          return plugin;
        })
      );

    return PluginSystem.of({
      load: (plugin) =>
        Effect.gen(function* () {
          yield* plugin.init();
          yield* Ref.update(plugins, HashMap.set(plugin.meta.id, plugin));
          yield* updateStatus(plugin.meta.id, "inactive");
        }),

      start: (pluginId) =>
        Effect.gen(function* () {
          const pluginOpt = yield* Ref.get(plugins).pipe(Effect.map(HashMap.get(pluginId)));

          yield* Option.match(pluginOpt, {
            onNone: () => Effect.fail(new Error(`Plugin ${pluginId} not found`)),
            onSome: (plugin) =>
              pipe(
                plugin.start(),
                Effect.tap(() => updateStatus(pluginId, "running")),
                Effect.tapError(() => updateStatus(pluginId, "error"))
              ),
          });
        }),

      stop: (pluginId) =>
        Effect.gen(function* () {
          const pluginOpt = yield* Ref.get(plugins).pipe(Effect.map(HashMap.get(pluginId)));

          yield* Option.match(pluginOpt, {
            onNone: () => Effect.void,
            onSome: (plugin) =>
              pipe(
                plugin.stop(),
                Effect.tap(() => updateStatus(pluginId, "stopped"))
              ),
          });
        }),

      dispatch: (event) =>
        Effect.gen(function* () {
          const allPlugins = yield* Ref.get(plugins).pipe(Effect.map(HashMap.toValues));

          yield* Effect.forEach(allPlugins, (plugin) =>
            plugin.onEvent(event).pipe(
              Effect.catchAll((error) => Effect.logError(`Plugin ${plugin.meta.id} handle event failed`, error)),
              Effect.forkDaemon
            )
          );
        }),

      get: (pluginId) => Ref.get(plugins).pipe(Effect.map(HashMap.get(pluginId))),

      list: () => Ref.get(plugins).pipe(Effect.map(HashMap.toValues)),
    });
  })
);
