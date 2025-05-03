import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { AppRouter } from "trpc-server/src/index.js";
import { C } from "./util/config.js";
import { get } from "./util/request.js";
import { logger } from "./util/logger.js";
import { redis } from "./util/redis.js";
import { origin } from "./util/serve.js";
import { onebot } from "./onebot.js";

const redisKey = "arona_twitter_bajp_sent";

const trpc = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: C.TRPC_SERVER })] });
export async function subscribeTwitter() {
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
}
