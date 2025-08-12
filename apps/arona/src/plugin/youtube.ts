import { join } from "node:path";
import { execSync } from "node:child_process";
import { captureException } from "@sentry/node";
import { C } from "../config.js";
import { onebot } from "../onebot.js";
import { logger as parentLogger } from "../util/logger.js";
import { redis, staticOrigin, trpc } from "./context.js";
import { AronaPlugin } from "./index.js";

const logger = parentLogger.child({ module: "youtube" });

export class YouTubePlugin implements AronaPlugin {
  private REDIS_YOUTUBE_SENT = "arona_youtube_bajp_sent";
  private intervalId: NodeJS.Timeout | null = null;
  private lock = false;

  private async subscribeYoutube() {
    const videos = await trpc.youtube.query({ channelId: "UCmgf8DJrAXFnU7j3u0kklUQ" });
    for (const video of videos.slice(0, 1)) {
      if (await redis.sIsMember(this.REDIS_YOUTUBE_SENT, video.videoId)) {
        continue;
      }
      const link = `https://www.youtube.com/watch?v=${video.videoId}`;
      const path = video.videoId;
      logger.info(`New video detect: ${link}`);

      const isLive = execSync(`yt-dlp --print is_live ${link}`).toString().includes("True");
      if (isLive) {
        logger.info("Video is live");
        await redis.sAdd(this.REDIS_YOUTUBE_SENT, video.videoId);
        continue;
      }

      const videoInfo = execSync(`yt-dlp --print duration,uploader ${link}`).toString().split("\n");
      const duration = Number.parseInt(videoInfo[0]);
      const uploader = videoInfo[1];
      if (isNaN(duration)) {
        throw new Error("Get video duration error");
      }
      if (!uploader.includes("Blue Archive")) {
        throw new Error("Malformed video");
      }

      if (duration > 300) {
        logger.warn("Video length larger than 5:00, ignore");
      } else {
        execSync(
          `yt-dlp -f "bestvideo[height<=1080]+bestaudio/best[height<=1000]" --merge-output-format mp4 -o "${join(C.STATIC_ROOT, path)}" ${link}`
        );
        await onebot.post("send_group_msg", {
          group_id: C.GROUP_ID,
          message: [{ type: "video", data: { file: `${staticOrigin}/${path}.mp4` } }],
        });
        logger.info("YouTube video send to group done");
      }
      await redis.sAdd(this.REDIS_YOUTUBE_SENT, video.videoId);
    }
  }

  activate(): void {
    if (!this.intervalId) {
      this.intervalId = setInterval(() => {
        if (!this.lock) {
          this.lock = true;
          this.subscribeYoutube()
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
