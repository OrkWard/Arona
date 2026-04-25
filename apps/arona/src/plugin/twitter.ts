import ky from "ky";
import { CronPlugin } from "../core/plugin.js";
import { logger as parentLogger } from "../util/logger.js";

const logger = parentLogger.child({ module: "twitter" });

const MAX_TWEETS_TO_PROCESS = 2;
const REDIS_TWITTER_SENT = "arona_twitter_bajp_sent";
const TWITTER_USERNAME = "Blue_ArchiveJP";

export interface TwitterPluginConfig {
  twitterUsername: string;
  groupId: number | number[];
}

export class TwitterPlugin extends CronPlugin {
  cron = "*/10 * * * * *";

  async task() {
    const tweets = await this.wormface.getUserPosts(TWITTER_USERNAME);
    const redis = await this.redis.getClient();

    for (const tweet of tweets.slice(0, MAX_TWEETS_TO_PROCESS)) {
      const { id: tweetId } = tweet;

      const isMember = await redis.sIsMember(REDIS_TWITTER_SENT, tweetId);
      if (isMember) continue;

      logger.info(`New Tweet detected: [${tweetId}] ${tweet}`);
      await redis.sAdd(REDIS_TWITTER_SENT, tweetId);
      logger.info("Tweet record add to redis");

      const targetGroups = Array.isArray(this.config.groupId) ? this.config.groupId : [this.config.groupId];

      for (const groupId of targetGroups) {
        if (tweet.type === "post") {
          const media = await Promise.all(
            tweet.media.map(async (url) => {
              const buffer = await ky.get(url).arrayBuffer();
              const savedUrl = await this.s3.saveMedia(Buffer.from(buffer), "jpg");
              logger.info(`Saved url: ${savedUrl}`);
              return savedUrl;
            })
          );

          await this.onebot.post("send_group_msg", {
            group_id: groupId,
            message: [
              { type: "text", data: { text: tweet.text } },
              ...media.map((url) => ({ type: "image" as const, data: { file: url } })),
            ],
          });
        } else if (tweet.type === "conversation") {
          let lastMsgId: string | undefined;
          for (const singleTweet of tweet.items) {
            const media = await Promise.all(
              singleTweet.media.map(async (url) => {
                const buffer = await ky.get(url).arrayBuffer();
                const savedUrl = await this.s3.saveMedia(Buffer.from(buffer), "jpg");
                logger.info(`Saved url: ${savedUrl}`);
                return savedUrl;
              })
            );

            const msg = await this.onebot.post("send_group_msg", {
              group_id: groupId,
              message: [
                ...(lastMsgId ? [{ type: "reply" as const, data: { id: lastMsgId } }] : []),
                { type: "text", data: { text: singleTweet.text } },
                ...media.map((url) => ({ type: "image" as const, data: { file: url } })),
              ],
            });
            logger.info(`Sent msg: ${msg}`);
            lastMsgId = msg.message_id.toString();
          }
        }
      }

      logger.info("Tweet sent to groups done");
    }
  }
}
