import { Context, Layer, Effect } from "effect";
import { OneBot, OneBotActions, OneBotError } from "onebot";

export class OneBotService extends Context.Tag("onebot")<
  OneBotService,
  {
    readonly post: <T extends keyof OneBotActions>(
      actionName: T,
      actionParams: OneBotActions[T][0]
    ) => Effect.Effect<OneBotActions[T][1], OneBotError>;
  }
>() {
  static readonly makeLive = (ob: OneBot) =>
    Layer.succeed(
      OneBotService,
      OneBotService.of({
        post: (name, params) =>
          Effect.tryPromise({
            try: () => ob.post(name, params),
            catch: (error) => error as OneBotError,
          }),
      })
    );
}
