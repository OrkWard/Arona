import { Effect, Option, pipe } from "effect";
import { Command, Plugin, PluginMeta, PluginStatus } from "./base.js";
import { OneBotEvent } from "onebot";

export interface Config {
  commands: Command[];
  // 是否独占处理（阻止其他插件处理）
  exclusive?: boolean;
}

export abstract class CommandPlugin extends Plugin {
  constructor(
    meta: PluginMeta,
    status: PluginStatus,
    private readonly config: Config
  ) {
    super(meta, status);
  }

  // 检查是否匹配命令
  matchCommand(event: OneBotEvent): Option.Option<Command> {
    return Option.fromNullable(this.config.commands.find((cmd) => new RegExp(cmd.pattern).test(event.post_type)));
  }

  // 命令处理器
  abstract handleCommand(event: OneBotEvent, command: Command): Effect.Effect<void>;

  // 覆盖事件处理
  onEvent(event: OneBotEvent): Effect.Effect<void> {
    return pipe(
      this.matchCommand(event),
      Option.match({
        onNone: () => Effect.void,
        onSome: (command) => this.handleCommand(event, command),
      })
    );
  }
}
