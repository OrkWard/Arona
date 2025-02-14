import { config } from "dotenv";
import { findUpSync } from "find-up";
import { Logger, OneBot } from "onebot";
import { serverStatic } from "./serve.js";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { execAsync } from "./utils.js";
import { getLastTweetContent } from "./twitter.js";

config({ path: findUpSync(".env") });

const staticRoot = "./static";
if (!existsSync(staticRoot)) {
  mkdirSync(staticRoot);
}
const staticPort = 8888;
serverStatic(staticRoot, staticPort);
const sent = new Set<string>();
const logger = new Logger();
const onebot = new OneBot(logger, { authKey: process.env.ONEBOT_AUTH_TOKEN!, origin: process.env.ONEBOT_ORIGIN! });

setInterval(
  async () => {
    try {
      const timelineTweets = await getLastTweetContent();
      for (const tweet of timelineTweets) {
        if (!sent.has(tweet.tweetId)) {
          const medias = await Promise.all(
            tweet.media?.map(async (m) => {
              const path = crypto.randomUUID();
              await writeFile(join(staticRoot, path), await m.buffer);
              const hostname = await execAsync("tailscale status --peers=false | awk '{print $2}'");
              return { url: `http://${hostname}:${staticPort}/${path}`, type: m.type };
            }) || []
          );

          await onebot.post("send_group_msg", {
            group_id: 909983720,
            message: [{ type: "text", data: { text: tweet.text } }],
          });
          await Promise.all(
            medias.map((media) =>
              onebot.post("send_group_msg", {
                group_id: 909983720,
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
