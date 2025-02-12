import { config } from "dotenv";
import { findUpSync } from "find-up";
import { getTweetMedia, prepareAPI, type TimelineTweetLegacy } from "twitter-scraper";
import { decode } from "html-entities";
import { Logger, OneBot } from "onebot";
import { serverStatic } from "./serve.js";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

function getTweetContent(tweet: TimelineTweetLegacy) {
  const tweetId = tweet.id_str;
  const text = decode(tweet.full_text);
  const media = tweet.entities.media?.map(getTweetMedia);
  return {
    tweetId,
    text,
    media,
  };
}

async function startSubscribe() {
  const { getUserId, getUserTweets } = await prepareAPI({
    cookie: process.env.cookie,
    referer: `https://x.com/blue_archivejp/media`,
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "x-csrf-token": process.env["x-csrf-token"],
    Authorization: process.env.Authorization,
  });

  setInterval(
    async () => {
      try {
        const id = await getUserId("blue_archivejp");
        const entries = await getUserTweets(id);
        const timelineTweets = entries
          .slice(0, 1)
          .filter((e) => ["TimelineTimelineItem", "TimelineTimelineModule"].includes(e.content.entryType))
          .map((e) =>
            e.content.entryType === "TimelineTimelineItem"
              ? e.content.itemContent
              : e.content.items.map((i) => i.item.itemContent)
          )
          .flat()
          .filter((t) => t.itemType === "TimelineTweet")
          .map((t) => t.tweet_results.result.legacy)
          .map(getTweetContent);

        for (const tweet of timelineTweets) {
          if (!sent.has(tweet.tweetId)) {
            const medias = await Promise.all(
              tweet.media?.map(async (m) => {
                const path = crypto.randomUUID();
                await writeFile(join(staticRoot, path), await m.buffer);
                return { url: "http://airm3:" + staticPort + "/" + path, type: m.type };
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
}

config({ path: findUpSync(".env") });

const staticRoot = "./static";
const staticPort = 8888;
serverStatic(staticRoot, staticPort);
const sent = new Set<string>();
const logger = new Logger();
const onebot = new OneBot(logger, { authKey: process.env.ONEBOT_AUTH_TOKEN!, origin: process.env.ONEBOT_ORIGIN! });
onebot.onOpen(startSubscribe);
