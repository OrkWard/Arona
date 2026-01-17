import { Context, Effect, Layer } from "effect";
import { RequiredError, TwitterApi, YoutubeApi, type YoutubeYouTubeVideo, type TwitterTweetEntry } from "wormface-openapi";

export interface WormfaceServiceShape {
  readonly twitter: {
    readonly getUserPosts: (params: { username: string }) => Effect.Effect<TwitterTweetEntry[], RequiredError>;
  };
  readonly youtube: {
    readonly getChannelVideos: (params: { channel: string }) => Effect.Effect<YoutubeYouTubeVideo[], RequiredError>;
  };
}

export class WormfaceService extends Context.Tag("WormfaceService")<WormfaceService, WormfaceServiceShape>() {
  static makeLive = (basePath: string) => {
    const twitterApi = new TwitterApi({ basePath });
    const youtubeApi = new YoutubeApi({ basePath });

    return Layer.succeed(
      WormfaceService,
      WormfaceService.of({
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
      })
    );
  };
}
