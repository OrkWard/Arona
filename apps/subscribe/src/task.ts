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
import { execSync } from "node:child_process";

const REDIS_TWITTER_SENT = "arona_twitter_bajp_sent";
const REDIS_YOUTUBE_SENT = "arona_youtube_bajp_sent";

const trpc = createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: C.TRPC_SERVER })] });
export async function subscribeTwitter() {
  const tweets = await trpc.twitter.query({ username: "bluearchive_jp" });
  for (const tweet of tweets.slice(0, 3)) {
    if (await redis.sIsMember(REDIS_TWITTER_SENT, tweet.tweetId)) {
      return;
    }
    logger.info(`New tweet detected: ${tweet.text.slice(0, tweet.text.indexOf("\n"))}`);

    await onebot.post("send_group_msg", {
      group_id: C.GROUP_ID,
      message: [{ type: "text", data: { text: tweet.text } }],
    });
    // if text content sent with succuess, ignore the error
    await redis.sAdd(REDIS_TWITTER_SENT, tweet.tweetId);
    logger.info(`New tweet text sent and save to cache: ${tweet.text.slice(0, tweet.text.indexOf("\n"))}`);

    const mediaList = await Promise.all(
      tweet.media?.map(async (m) => {
        const path = crypto.randomUUID();
        await writeFile(join(C.STATIC_ROOT, path), await get(m.url).buffer());
        return { url: `${origin}/${path}`, type: m.type };
      }) || []
    );
    await Promise.all(
      mediaList.map((media) =>
        onebot.post("send_group_msg", {
          group_id: C.GROUP_ID,
          message: [{ type: media.type === "video" ? "video" : "image", data: { file: media.url } }],
        })
      )
    );
    logger.info("Tweet send to group done");
  }
}

export async function subscribeYoutube() {
  const videos = await trpc.youtube.query({ channelId: "UCmgf8DJrAXFnU7j3u0kklUQ" });
  for (const video of videos.slice(0, 3)) {
    if (await redis.sIsMember(REDIS_YOUTUBE_SENT, video.videoId)) {
      return;
    }
    const link = `https://www.youtube.com/watch?v=${video.videoId}`;
    const path = video.videoId;
    logger.info(`New video detect: ${link}`);
    const duration = Number.parseInt(execSync(`yt-dlp --print duration ${link}`).toString());
    if (isNaN(duration)) {
      throw new Error("Get video duration error");
    }
    if (duration > 300) {
      logger.warn("Video length larger than 5:00, ignore");
    } else {
      execSync(
        `yt-dlp -f "bestvideo[height<=480]+bestaudio/best[height<=400]" --merge-output-format mp4 -o "${join(C.STATIC_ROOT, path)}" ${link}`
      );
      await onebot.post("send_group_msg", {
        group_id: C.GROUP_ID,
        message: [{ type: "video", data: { file: `${origin}/${path}` } }],
      });
      logger.info("YouTube video send to group done");
    }
    await redis.sAdd(REDIS_YOUTUBE_SENT, video.videoId);
  }
}
