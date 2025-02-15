import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Logger, OneBot } from "onebot";

import { serverStatic } from "./serve.js";
import { getLastTweetContent } from "./twitter.js";
import C from "../config.json" assert { type: "json" };

const origin = serverStatic();
const sent = new Set<string>();
const logger = new Logger();
const onebot = new OneBot(logger, { authKey: C.ONEBOT_AUTH_TOKEN, origin: C.ONEBOT_ORIGIN });

setInterval(
  async () => {
    try {
      const timelineTweets = await getLastTweetContent();
      for (const tweet of timelineTweets) {
        if (!sent.has(tweet.tweetId)) {
          const medias = await Promise.all(
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
            medias.map((media) =>
              onebot.post("send_group_msg", {
                group_id: C.GROUP_ID,
                message: [{ type: media.type === "video" ? "video" : "image", data: { file: media.url } }],
              })
            )
          );
          sent.add(tweet.tweetId);
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
