import "./sentry.js";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert";
import * as Sentry from "@sentry/node";
import { OneBot } from "onebot";
import { createClient } from "redis";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Logger } from "common";
import { type AppRouter } from "trpc-server/src/index.js";

import { serverStatic } from "./serve.js";
import { C } from "./config.js";
import { get } from "./request.js";

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
const trpc = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: C.TRPC_SERVER })] });

setInterval(async () => {
  try {
    const timelineTweets = (await trpc.twitter.query({ username: "bluearchive_jp" })).slice(0, 3);
    for (const tweet of timelineTweets) {
      if (!(await redis.sIsMember(redisKey, tweet.tweetId))) {
        logger.info("New tweet detected");

        const mediaList = await Promise.all(
          tweet.media?.map(async (m) => {
            const path = crypto.randomUUID();
            await writeFile(join(C.STATIC_ROOT, path), await get(m.url).buffer());
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
}, 1000 * 5);
