import { join } from "node:path";

import { logger as parentLogger } from "../util/logger.js";
import { Effect } from "effect";
import { OneBotService, RedisService, StaticService, WormfaceService } from "../core/services/index.js";
import { Command } from "@effect/platform";

const logger = parentLogger.child({ module: "youtube" });

const REDIS_YOUTUBE_SENT = "arona_youtube_bajp_sent";
export class YouTubePlugin {
  private lock = false;

  subscribeYoutube() {
    return Effect.gen(function* () {
      const { youtube } = yield* WormfaceService;
      const { client: redis } = yield* RedisService;
      const onebot = yield* OneBotService;
      const sta = yield* StaticService;

      const videos = yield* youtube.getChannelVideos({ channel: "UCmgf8DJrAXFnU7j3u0kklUQ" });

      for (const video of videos.slice(0, 1)) {
        if (yield* redis.sIsMember(this.REDIS_YOUTUBE_SENT, video.videoId)) {
          continue;
        }
        const link = `https://www.youtube.com/watch?v=${video.videoId}`;
        const path = video.videoId!;
        logger.info(`New video detect: ${link}`);

        const isLive = (yield* Command.string(Command.make("yt-dlp", "--print", "is_live", link))).includes("True");
        if (isLive) {
          logger.info("Video is live");
          yield* redis.sAdd(REDIS_YOUTUBE_SENT, video.videoId);
          continue;
        }

        const getInfoCmd = Command.make("yt-dlp", "--print", "duration,uploader", link);

        const videoInfo = (yield* Command.string(getInfoCmd)).split("\n");
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
          const downloadCmd = Command.make(
            "yt-dlp",
            "-f",
            `"bestvideo[height<=1080]+bestaudio/best[height<=1000]"`,
            "--merge-output-format",
            "mp4",
            "-o",
            join(process.env.STATIC_ROOT, path),
            link
          );
          yield* Command.exitCode(downloadCmd);
          yield* onebot.post("send_group_msg", {
            group_id: Number.parseInt(process.env.QQ_GROUP_ID),
            message: [{ type: "video", data: { file: `${sta.origin}/${path}.mp4` } }],
          });
          logger.info("YouTube video send to group done");
        }
        yield* redis.sAdd(REDIS_YOUTUBE_SENT, video.videoId);
      }
    });
  }
}
