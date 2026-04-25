import { CronPlugin } from "../core/plugin.js";
import { logger as parentLogger } from "../util/logger.js";
import { got } from "got";

const logger = parentLogger.child({ module: "twitter" });
const { get } = got;

const MAX_TWEETS_TO_PROCESS = 2;
const REDIS_TWITTER_SENT = "arona_twitter_bajp_sent";

export interface TwitterPluginConfig {
  twitterUsername: string;
  groupId: number | number[];
}

export class TwitterPlugin extends CronPlugin {
  cron = "*/10 * * * * *";

  async task() {
    const tweets = await this.wormface.getUserPosts("Blue_ArchiveJP");
    const redis = await this.redis.getClient();

    for (const tweet of tweets.slice(0, MAX_TWEETS_TO_PROCESS)) {
      const { id: tweetId, media: tweetMedia, text } = tweet;

      const isMember = await redis.sIsMember(REDIS_TWITTER_SENT, tweetId);
      if (isMember) {
        continue;
      }
      logger.info(`New Tweet detected: [${tweetId}] ${text?.slice(20)}`);
      await redis.sAdd(REDIS_TWITTER_SENT, tweetId);
      logger.info("Tweet record add to redis");

      const targetGroups = Array.isArray(this.config.groupId) ? this.config.groupId : [this.config.groupId];

      for (const groupId of targetGroups) {
        if (text) {
          await this.onebot.post("send_group_msg", {
            group_id: groupId,
            message: [{ type: "text", data: { text } }],
          });
        }

        if (tweetMedia) {
          logger.info(`Media counts: ${tweetMedia.length}`);
          for (const mediaUrl of tweetMedia) {
            const buffer = await get(mediaUrl).buffer();
            const url = await this.s3.saveMedia(buffer, "jpg");
            logger.info(`Saved url: ${url}`);

            await this.onebot.post("send_group_msg", {
              group_id: groupId,
              message: [{ type: "image", data: { file: url } }],
            });
          }
        }
      }

      logger.info("Tweet sent to groups done");
    }
  }
}
