import { join } from "node:path";
import { captureException } from "@sentry/node";

import { randomUUID } from "node:crypto";
import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

import { logger as parentLogger } from "../util/logger.js";
import { get } from "../util/request.js";
import { OneBotService, RedisService, StaticService, WormfaceService } from "../core/services/index.js";
import { TwitterTweetEntry } from "wormface-openapi";

const logger = parentLogger.child({ module: "twitter" });

const MAX_TWEETS_TO_PROCESS = 2;
const REDIS_TWITTER_SENT = "arona_twitter_bajp_sent";

const getTweet = (entry: TwitterTweetEntry) => entry.content?.itemContent?.tweetResults?.result;

export class TwitterPlugin {
  subscribeTwitter() {
    return Effect.gen(function* () {
      const { client: redis } = yield* RedisService;
      const onebot = yield* OneBotService;
      const fs = yield* FileSystem.FileSystem;
      const sta = yield* StaticService;
      const { twitter } = yield* WormfaceService;

      const tweets = yield* twitter.getUserPosts({ username: "Blue_ArchiveJP" });
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
          group_id: Number.parseInt(process.env.QQ_GROUP_ID),
          message: [{ type: "text", data: { text } }],
        });

        yield* Effect.promise(() => redis.sAdd(REDIS_TWITTER_SENT, tweetId));
        logger.info(`New tweet text sent and save to cache: ${text.slice(0, text.indexOf("\n"))}`);

        if (!tweet.legacy.entities?.media) {
          continue;
        }
        for (const media of tweet.legacy.entities.media) {
          const mediaUrl =
            media.type === "video"
              ? media.videoInfo?.variants?.find((v) => v.contentType === "video/mp4")?.url
              : media.mediaUrlHttps;

          if (!mediaUrl) continue;

          const mediaId = `${randomUUID()}.${media.type === "video" ? "mp4" : "jpg"}`;

          const effect = Effect.gen(function* () {
            const buffer = yield* Effect.promise(() => get(mediaUrl).buffer());
            yield* fs.writeFile(join(process.env.STATIC_ROOT, mediaId), buffer);

            yield* onebot.post("send_group_msg", {
              group_id: Number.parseInt(process.env.QQ_GROUP_ID),
              message: [
                { type: media.type === "video" ? "video" : "image", data: { file: `${sta.origin}/${mediaId}` } },
              ],
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
        logger.info("Tweet send to group done");
      }
    });
  }
}
