import { captureException } from "@sentry/node";
import { Effect } from "effect";

import { logger as parentLogger } from "../util/logger.js";
import { get } from "../util/request.js";
import { OneBotService, RedisService, MediaService, WormfaceService } from "../services/index.js";
import type { CronPlugin } from "../types.js";
import type { TwitterTweetEntry } from "wormface-openapi";

const logger = parentLogger.child({ module: "twitter" });

const MAX_TWEETS_TO_PROCESS = 2;
const REDIS_TWITTER_SENT = "arona_twitter_bajp_sent";

const getTweet = (entry: TwitterTweetEntry) => entry.content?.itemContent?.tweetResults?.result;

export interface TwitterPluginConfig {
  qqGroupId: number;
  twitterUsername: string;
}

export const createTwitterPlugin = (config: TwitterPluginConfig): CronPlugin => ({
  interval: 10_000,

  task: () =>
    Effect.gen(function* () {
      const { client: redis } = yield* RedisService;
      const onebot = yield* OneBotService;
      const media = yield* MediaService;
      const { twitter } = yield* WormfaceService;

      const tweets = yield* twitter.getUserPosts({ username: config.twitterUsername });

      for (const entry of tweets.slice(0, MAX_TWEETS_TO_PROCESS)) {
        const tweet = getTweet(entry);
        if (!tweet?.restId || !tweet.legacy?.fullText) continue;

        const tweetId = tweet.restId;

        const isMember = yield* Effect.promise(() => redis.sIsMember(REDIS_TWITTER_SENT, tweetId));
        if (isMember) {
          continue;
        }

        const text = tweet.legacy.fullText;
        logger.info(`New tweet detected: ${text.slice(0, text.indexOf("\n"))}`);

        yield* onebot.post("send_group_msg", {
          group_id: config.qqGroupId,
          message: [{ type: "text", data: { text } }],
        });

        yield* Effect.promise(() => redis.sAdd(REDIS_TWITTER_SENT, tweetId));
        logger.info(`New tweet text sent and saved to cache: ${text.slice(0, text.indexOf("\n"))}`);

        if (!tweet.legacy.entities?.media) {
          continue;
        }

        for (const mediaItem of tweet.legacy.entities.media) {
          const mediaUrl =
            mediaItem.type === "video"
              ? mediaItem.videoInfo?.variants?.find((v) => v.contentType === "video/mp4")?.url
              : mediaItem.mediaUrlHttps;

          if (!mediaUrl) continue;

          const ext = mediaItem.type === "video" ? "mp4" : "jpg";

          const effect = Effect.gen(function* () {
            const buffer = yield* Effect.promise(() => get(mediaUrl).buffer());
            const url = yield* media.saveMedia(buffer, ext);

            yield* onebot.post("send_group_msg", {
              group_id: config.qqGroupId,
              message: [{ type: mediaItem.type === "video" ? "video" : "image", data: { file: url } }],
            });
          });

          yield* effect.pipe(
            Effect.catchAll((e) =>
              Effect.sync(() => {
                logger.error(`Failed to process media ${mediaUrl}: ${e}`);
                captureException(e);
              })
            )
          );
        }

        logger.info("Tweet sent to group done");
      }
    }),
});
