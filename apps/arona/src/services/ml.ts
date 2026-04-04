import { Context, Effect, Layer } from "effect";
import { ImageHashResponse, processImageGetImageHashPost } from "../codegen/ml/index.js";
import { createClient } from "../codegen/ml/client/client.gen.js";

export interface MlServiceShape {
  readonly getImageHash: (params: { url: string }) => Effect.Effect<ImageHashResponse, Error>;
}

export class MlService extends Context.Tag("MlService")<MlService, MlServiceShape>() {
  static makeLive = (baseUrl: string) => {
    const client = createClient({ baseUrl });

    return Layer.succeed(
      MlService,
      MlService.of({
        getImageHash: ({ url }) =>
          Effect.promise(() => processImageGetImageHashPost({ client, body: { url } })).pipe(
            Effect.flatMap((res) => {
              if (typeof res.error !== "undefined") {
                return Effect.fail(new Error(`ML API returned error: ${JSON.stringify(res.error)}`));
              }
              return Effect.succeed(res.data);
            })
          ),
      })
    );
  };
}
