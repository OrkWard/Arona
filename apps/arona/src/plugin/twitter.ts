import ky from "ky";
import { CronPlugin } from "../core/plugin.js";
import { logger as parentLogger } from "../util/logger.js";
import { Tweet } from "../services/wormface.js";

const logger = parentLogger.child({ module: "twitter" });

const MAX_TWEETS_TO_PROCESS = 10;
const REDIS_TWITTER_SENT = "arona_twitter_bajp_sent";
const TWITTER_USERNAME = "Blue_ArchiveJP";

export interface TwitterPluginConfig {
  twitterUsername: string;
  groupId: number | number[];
}

function isTweetEmpty(tweet: Tweet): boolean {
  if (tweet.type === "post") {
    return !tweet.text && tweet.image.length === 0 && tweet.video.length === 0;
  } else if (tweet.type === "conversation") {
    return tweet.items.reduce((acc, cur) => acc && isTweetEmpty({ type: "post", ...cur, id: "" }), true);
  }

  return true;
}

export class TwitterPlugin extends CronPlugin {
  cron = "*/10 * * * * *";

  private async sendImage(url: string, groupId: number) {
    const buffer = await ky.get(url).arrayBuffer();
    const savedUrl = await this.s3.saveMedia(Buffer.from(buffer), "jpg");
    logger.info(`Saved url: ${savedUrl}`);
    this.onebot.post("send_group_msg", {
      group_id: groupId,
      message: [{ type: "image", data: { file: savedUrl } }],
    });
  }

  private async sendVideo(url: string, groupId: number) {
    const buffer = await ky.get(url).arrayBuffer();
    const savedUrl = await this.s3.saveMedia(Buffer.from(buffer), "mp4");
    logger.info(`Saved url: ${savedUrl}`);
    this.onebot.post("send_group_msg", {
      group_id: groupId,
      message: [{ type: "video", data: { file: savedUrl } }],
    });
  }

  async task() {
    const tweets = await this.wormface.getUserPosts(TWITTER_USERNAME);
    const redis = await this.redis.getClient();

    for (const tweet of tweets.slice(0, MAX_TWEETS_TO_PROCESS)) {
      const { id: tweetId } = tweet;

      if (isTweetEmpty(tweet)) continue;

      const isMember = await redis.sIsMember(REDIS_TWITTER_SENT, tweetId);
      if (isMember) continue;

      logger.info(`New Tweet detected: [${tweetId}] ${JSON.stringify(tweet, undefined, "  ")}`);
      await redis.sAdd(REDIS_TWITTER_SENT, tweetId);
      logger.info("Tweet record add to redis");

      const targetGroups = Array.isArray(this.config.groupId) ? this.config.groupId : [this.config.groupId];

      for (const groupId of targetGroups) {
        if (tweet.type === "post") {
          await this.onebot.post("send_group_msg", {
            group_id: groupId,
            message: [{ type: "text", data: { text: tweet.text } }],
          });
          await Promise.all(tweet.image.map((url) => this.sendImage(url, groupId)));
          await Promise.all(tweet.video.map((url) => this.sendVideo(url, groupId)));
        } else if (tweet.type === "conversation") {
          for (const singleTweet of tweet.items) {
            await this.onebot.post("send_group_msg", {
              group_id: groupId,
              message: [{ type: "text", data: { text: singleTweet.text } }],
            });
            await Promise.all(singleTweet.image.map((url) => this.sendImage(url, groupId)));
            await Promise.all(singleTweet.video.map((url) => this.sendVideo(url, groupId)));
          }
        }
      }

      logger.info("Tweet sent to groups done");

      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
    }
  }
}
