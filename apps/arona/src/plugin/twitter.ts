import { Effect } from "effect";

import { logger as parentLogger } from "../util/logger.js";
import { get } from "../util/request.js";
import { OneBotService, RedisService, S3Service, WormfaceService } from "../services/index.js";
import type { CronPlugin } from "../types.js";

const logger = parentLogger.child({ module: "twitter" });

const MAX_TWEETS_TO_PROCESS = 2;
const REDIS_TWITTER_SENT = "arona_twitter_bajp_sent";

export interface TwitterPluginConfig {
  qqGroupId: number;
  twitterUsername: string;
}

export const createTwitterPlugin = (config: TwitterPluginConfig): CronPlugin => ({
  interval: 10_000,

  task: Effect.gen(function* () {
    const { client: redis } = yield* RedisService;
    const onebot = yield* OneBotService;
    const media = yield* S3Service;
    const { twitter } = yield* WormfaceService;

    const tweets = yield* twitter.getUserPosts({ username: config.twitterUsername });

    for (const tweet of tweets.slice(0, MAX_TWEETS_TO_PROCESS)) {
      const { id: tweetId, media: tweetMedia, text } = tweet;

      const isMember = yield* Effect.promise(() => redis.sIsMember(REDIS_TWITTER_SENT, tweetId));
      if (isMember) {
        continue;
      }
      logger.info(`New Tweet detected: [${tweetId}] ${text?.slice(20)}`);
      yield* Effect.promise(() => redis.sAdd(REDIS_TWITTER_SENT, tweetId));
      logger.info("Tweet record add to redis");

      if (text) {
        yield* onebot.post("send_group_msg", {
          group_id: config.qqGroupId,
          message: [{ type: "text", data: { text } }],
        });
      }

      if (tweetMedia) {
        for (const mediaUrl of tweetMedia) {
          const buffer = yield* Effect.promise(() => get(mediaUrl).buffer());
          const url = yield* media.saveMedia(buffer, "jpg");

          yield* onebot.post("send_group_msg", {
            group_id: config.qqGroupId,
            message: [{ type: "image", data: { file: url } }],
          });
        }
      }

      logger.info("Tweet sent to group done");
    }
  }),
});
