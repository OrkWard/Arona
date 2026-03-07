import { Context, Effect, Layer } from "effect";
import { createClient } from "../codegen/wormface/client/client.gen.js";
import {
  getTwitterByUserNamePosts,
  getYoutubeByChannelNameVideos,
  YoutubeYouTubeVideo,
} from "../codegen/wormface/index.js";

export interface WormfaceServiceShape {
  readonly twitter: {
    readonly getUserPosts: (params: {
      username: string;
    }) => Effect.Effect<{ text?: string; media?: string[]; id: string }[], Error>;
  };
  readonly youtube: {
    readonly getChannelVideos: (params: { channel: string }) => Effect.Effect<YoutubeYouTubeVideo[], Error>;
  };
}

export class WormfaceService extends Context.Tag("WormfaceService")<WormfaceService, WormfaceServiceShape>() {
  static makeLive = (basePath: string) => {
    const client = createClient({ baseUrl: basePath });

    return Layer.succeed(
      WormfaceService,
      WormfaceService.of({
        twitter: {
          getUserPosts: (params) =>
            Effect.promise(() => getTwitterByUserNamePosts({ client, path: { userName: params.username } })).pipe(
              Effect.flatMap((res) => {
                if (typeof res.error !== "undefined") {
                  return Effect.fail(new Error(res.error));
                }
                const result = [] as { text?: string; media?: string[]; id: string }[];
                res.data.forEach((tweet) => {
                  if (tweet.content?.entryType === "TimelineTimelineItem") {
                    result.push({
                      id: tweet.entryId!,
                      text: tweet.content.itemContent?.tweet_results?.result?.legacy?.full_text,
                      media: tweet.content.itemContent?.tweet_results?.result?.legacy?.entities?.media?.map(
                        (m) => m.media_url_https!
                      ),
                    });
                  } else if (tweet.content?.entryType === "TimelineTimelineModule") {
                    result.push(
                      ...(tweet.content?.items?.map((i) => ({
                        id: i.entryId!,
                        text: i.item?.itemContent?.tweet_results?.result?.legacy?.full_text,
                        media: i.item?.itemContent?.tweet_results?.result?.legacy?.entities?.media?.map(
                          (m) => m.media_url_https!
                        ),
                      })) || [])
                    );
                  }
                });
                return Effect.succeed(result);
              })
            ),
        },
        youtube: {
          getChannelVideos: (params) =>
            Effect.promise(() =>
              getYoutubeByChannelNameVideos({
                client,
                path: { channelName: params.channel },
              })
            ).pipe(
              Effect.flatMap((res) => {
                if (typeof res.error !== "undefined") {
                  return Effect.fail(new Error(res.error));
                }
                return Effect.succeed(res.data);
              })
            ),
        },
      })
    );
  };
}
