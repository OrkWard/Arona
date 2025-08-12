import { writeFile } from "node:fs/promises";
import { captureException } from "@sentry/node";
import { C } from "../config.js";
import { onebot } from "../onebot.js";
import { logger as parentLogger } from "../util/logger.js";
import { redis, staticOrigin, trpc } from "./context.js";
import { AronaPlugin } from "./index.js";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { get } from "../util/request.js";

const logger = parentLogger.child({ module: "twitter" });

export class TwitterPlugin implements AronaPlugin {
  private REDIS_TWITTER_SENT = "arona_twitter_bajp_sent";
  private intervalId: NodeJS.Timeout | null = null;
  private lock = false;

  private async subscribeTwitter() {
    const tweets = await trpc.twitter.query({ username: "bluearchive_jp" });
    for (const tweet of tweets.slice(0, 3)) {
      if (await redis.sIsMember(this.REDIS_TWITTER_SENT, tweet.tweetId)) {
        continue;
      }
      logger.info(`New tweet detected: ${tweet.text.slice(0, tweet.text.indexOf("\n"))}`);

      await onebot.post("send_group_msg", {
        group_id: C.GROUP_ID,
        message: [{ type: "text", data: { text: tweet.text } }],
      });
      // if text content sent with succuess, ignore the follow error
      await redis.sAdd(this.REDIS_TWITTER_SENT, tweet.tweetId);
      logger.info(`New tweet text sent and save to cache: ${tweet.text.slice(0, tweet.text.indexOf("\n"))}`);

      if (!tweet.media) {
        continue;
      }
      for (const media of tweet.media) {
        const mediaId = `${randomUUID()}.jpg`;
        await writeFile(join(C.STATIC_ROOT, mediaId), await get(media.url).buffer());
        await onebot.post("send_group_msg", {
          group_id: C.GROUP_ID,
          message: [{ type: media.type === "video" ? "video" : "image", data: { file: `${staticOrigin}/${mediaId}` } }],
        });
      }
      logger.info("Tweet send to group done");
    }
  }
  activate(): void {
    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        if (!this.lock) {
          this.lock = true;
          this.subscribeTwitter()
            .catch((e) => {
              logger.error(e);
              captureException(e);
            })
            .finally(() => {
              this.lock = false;
            });
        }
      }, 5 * 1000);
    }
  }

  deactivate(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
