import { Context, Effect, Layer } from "effect";
import {
  RequiredError,
  TwitterApi,
  YoutubeApi,
  type YoutubeYouTubeVideo,
  type TwitterTweetEntry,
} from "wormface-openapi";

export interface WormfaceServiceShape {
  readonly twitter: {
    readonly getUserPosts: (params: {
      username: string;
    }) => Effect.Effect<{ text?: string; media?: string[]; id: string }[], RequiredError>;
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
              try: () =>
                twitterApi.twitterUserNamePostsGet(params.username).then((tweets) => {
                  const result = [] as { text?: string; media?: string[]; id: string }[];
                  tweets.forEach((tweet) => {
                    if (tweet.content?.entryType === "TimelineTimelineItem") {
                      result.push({
                        id: tweet.entryId!,
                        text: tweet.content.itemContent?.tweetResults?.result?.legacy?.fullText,
                        media: tweet.content.itemContent?.tweetResults?.result?.legacy?.entities?.media?.map(
                          (m) => m.mediaUrlHttps!
                        ),
                      });
                    } else if (tweet.content?.entryType === "TimelineTimelineModule") {
                      result.push(
                        ...(tweet.content?.items?.map((i) => ({
                          id: i.entryId!,
                          text: i.item?.itemContent?.tweetResults?.result?.legacy?.fullText,
                          media: i.item?.itemContent?.tweetResults?.result?.legacy?.entities?.media?.map(
                            (m) => m.mediaUrlHttps!
                          ),
                        })) || [])
                      );
                    }
                  });
                  return [];
                }),
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
