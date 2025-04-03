import "./sentry.js";
import * as Sentry from "@sentry/node";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { OneBot } from "onebot";
import { createClient } from "redis";
import { Logger } from "common";

import { serverStatic } from "./serve.js";
import { getLastTweetContent } from "./twitter.js";
import { C } from "./config.js";

const origin = serverStatic();
const logger = new Logger();
const onebot = new OneBot(logger, { authKey: C.ONEBOT_AUTH_TOKEN, origin: C.ONEBOT_ORIGIN });

const redisKey = "arona_twitter_bajp_sent";
const redis = await createClient({ url: C.REDIS }).connect();

setInterval(
  async () => {
    try {
      const timelineTweets = await getLastTweetContent();
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
          await redis.sAdd(redisKey, tweet.tweetId);
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error(e.message);
      } else {
        console.error(e);
      }
    }
  },
  1000 * 5 * 60
);
