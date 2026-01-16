import { Context, Effect, Layer } from "effect";
import {
  RequiredError,
  TwitterApi,
  YoutubeApi,
  type YoutubeYouTubeVideo,
  type TwitterTweetEntry,
} from "wormface-openapi";

export class WormfaceService extends Context.Tag("wormface")<
  WormfaceService,
  {
    twitter: {
      getUserPosts: (params: { username: string }) => Effect.Effect<TwitterTweetEntry[], RequiredError>;
    };
    youtube: {
      getChannelVideos: (params: { channel: string }) => Effect.Effect<YoutubeYouTubeVideo[], RequiredError>;
    };
  }
>() {
  static Live = Layer.effect(
    WormfaceService,
    Effect.gen(function* () {
      const basePath = process.env.WORMFACE_ORIGIN || "//localhost:8080/";
      const twitterApi = new TwitterApi({ basePath });
      const youtubeApi = new YoutubeApi({ basePath });

      yield* Effect.logInfo("Twitter service initialized");

      return WormfaceService.of({
        twitter: {
          getUserPosts: (params) =>
            Effect.tryPromise({
              try: () => twitterApi.twitterUserNamePostsGet(params.username),
              catch: (error) => error as RequiredError,
            }),
        },
        youtube: {
          getChannelVideos: (params) =>
            Effect.tryPromise({
              try: () => youtubeApi.youtubeChannelNameVideosGet(params.channel),
              catch: (error) => error as RequiredError,
            }),
        },
      });
    })
  );
}
