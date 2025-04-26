import "./sentry.js";
import * as Sentry from "@sentry/node";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { OneBot } from "onebot";
import { createClient } from "redis";
import { Logger } from "common";

import { serverStatic } from "./serve.js";
import { getLast20TweetContent } from "./twitter.js";
import { C } from "./config.js";
import assert from "node:assert";

assert(C.STATIC_HOST);
assert(C.ONEBOT_ORIGIN);
assert(C.REDIS);

const origin = serverStatic();
const logger = new Logger();
const onebot = new OneBot(logger, { authKey: C.ONEBOT_AUTH_TOKEN, origin: C.ONEBOT_ORIGIN });

const redisKey = "arona_twitter_bajp_sent";
const redis = await createClient({ url: C.REDIS })
  .on("connect", () => logger.info("Redis connected"))
  .connect();

setInterval(
  async () => {
    try {
      // may contain more then 20 tweets (for example, self reply)
      const timelineTweets = await getLast20TweetContent();
      for (const tweet of timelineTweets) {
        if (!(await redis.sIsMember(redisKey, tweet.tweetId))) {
          logger.info("New tweet detected");

          const mediaList = await Promise.all(
            tweet.media?.map(async (m) => {
              const path = crypto.randomUUID();
              await writeFile(join(C.STATIC_ROOT, path), await m.buffer);
              return { url: `${origin}/${path}`, type: m.type };
            }) || []
          );

          // send msg and media for each tweet
          await onebot.post("send_group_msg", {
            group_id: C.GROUP_ID,
            message: [{ type: "text", data: { text: tweet.text } }],
          });
          await Promise.all(
            mediaList.map((media) =>
              onebot.post("send_group_msg", {
                group_id: C.GROUP_ID,
                message: [{ type: media.type === "video" ? "video" : "image", data: { file: media.url } }],
              })
            )
          );
          logger.info("Send to group done");

          // save to db
          await redis.sAdd(redisKey, tweet.tweetId);
        }
      }
    } catch (e) {
      Sentry.captureException(e);
      logger.error(e);
    }
  },
  1000 * 5 * 60
);
