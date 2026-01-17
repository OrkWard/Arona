import { Effect } from "effect";
import { Command } from "@effect/platform";

import { logger as parentLogger } from "../util/logger.js";
import { OneBotService, RedisService, MediaService, WormfaceService } from "../services/index.js";
import type { CronPlugin } from "../types.js";

const logger = parentLogger.child({ module: "youtube" });

const REDIS_YOUTUBE_SENT = "arona_youtube_bajp_sent";

export interface YouTubePluginConfig {
  qqGroupId: number;
  youtubeChannelId: string;
}

export const createYouTubePlugin = (config: YouTubePluginConfig): CronPlugin => ({
  interval: 10_000,

  task: Effect.gen(function* () {
    const { youtube } = yield* WormfaceService;
    const { client: redis } = yield* RedisService;
    const onebot = yield* OneBotService;
    const media = yield* MediaService;

    const videos = yield* youtube.getChannelVideos({ channel: config.youtubeChannelId });

    for (const video of videos.slice(0, 1)) {
      if (!video.videoId) {
        continue;
      }

      if (yield* Effect.promise(() => redis.sIsMember(REDIS_YOUTUBE_SENT, video.videoId!))) {
        continue;
      }

      const link = `https://www.youtube.com/watch?v=${video.videoId}`;
      const videoId = video.videoId!;
      logger.info(`New video detected: ${link}`);

      // Check if video is live
      const isLive = (yield* Command.string(Command.make("yt-dlp", "--print", "is_live", link))).includes("True");
      if (isLive) {
        logger.info("Video is live, skipping");
        yield* Effect.promise(() => redis.sAdd(REDIS_YOUTUBE_SENT, videoId));
        continue;
      }

      // Get video info
      const getInfoCmd = Command.make("yt-dlp", "--print", "duration,uploader", link);
      const videoInfo = (yield* Command.string(getInfoCmd)).split("\n");
      const duration = Number.parseInt(videoInfo[0]);
      const uploader = videoInfo[1];

      if (isNaN(duration)) {
        return yield* Effect.fail(new Error("Failed to get video duration"));
      }
      if (!uploader.includes("Blue Archive")) {
        return yield* Effect.fail(new Error("Video is not from Blue Archive channel"));
      }

      if (duration > 300) {
        logger.warn("Video length larger than 5:00, ignoring");
      } else {
        // Get target path for download
        const filename = `${videoId}.mp4`;
        const target = media.getMediaTarget(filename);

        // Download video
        const downloadCmd = Command.make(
          "yt-dlp",
          "-f",
          "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
          "--merge-output-format",
          "mp4",
          "-o",
          target.path,
          link
        );
        yield* Command.exitCode(downloadCmd);

        // Send to group
        yield* onebot.post("send_group_msg", {
          group_id: config.qqGroupId,
          message: [{ type: "video", data: { file: target.url } }],
        });

        logger.info("YouTube video sent to group done");
      }

      yield* Effect.promise(() => redis.sAdd(REDIS_YOUTUBE_SENT, videoId));
    }
  }),
});
