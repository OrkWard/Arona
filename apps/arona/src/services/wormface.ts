import { createClient } from "../codegen/wormface/client/client.gen.js";
import { Client } from "../codegen/ml/client/types.gen.js";
import { getTwitterByUserNamePosts, getYoutubeByChannelNameVideos } from "../codegen/wormface/index.js";
import { AppConfig } from "./config.js";
import { logger } from "../util/logger.js";
import { maxBy } from "es-toolkit";

export type Tweet =
  | { type: "post"; text: string; image: string[]; video: string[] }
  | {
      type: "conversation";
      items: {
        text: string;
        image: string[];
        video: string[];
      }[];
    };

export class WormfaceService {
  static inject = ["config"] as const;

  private client: Client;
  constructor(private config: AppConfig) {
    this.client = createClient({ baseUrl: this.config.wormfaceOrigin, throwOnError: true });
    logger.info("wormface client created");
  }

  async getUserPosts(username: string) {
    const res = await getTwitterByUserNamePosts({ client: this.client, path: { userName: username } });
    const result = [] as Tweet[];
    res.data.forEach((tweet) => {
      if (tweet.content?.entryType === "TimelineTimelineItem") {
        result.push({
          type: "post",
          text: tweet.content.itemContent?.tweet_results?.result?.legacy?.full_text ?? "",
          image:
            tweet.content.itemContent?.tweet_results?.result?.legacy?.entities?.media
              ?.filter((m) => m.type === "photo")
              ?.map((m) => m.media_url_https!) ?? [],
          video:
            tweet.content.itemContent?.tweet_results?.result?.legacy?.entities?.media
              ?.filter((m) => m.type === "video")
              ?.map((m) => {
                const info = m.video_info?.variants?.filter((v) => typeof v.bitrate === "number") || [];
                return maxBy(info, (v) => v.bitrate!)?.url!;
              }) ?? [],
        });
      } else if (tweet.content?.entryType === "TimelineTimelineModule") {
        result.push({
          type: "conversation",
          items:
            tweet.content?.items?.map((i) => ({
              text: i.item?.itemContent?.tweet_results?.result?.legacy?.full_text ?? "",
              image:
                i.item?.itemContent?.tweet_results?.result?.legacy?.entities?.media
                  ?.filter((m) => m.type === "photo")
                  ?.map((m) => m.media_url_https!) ?? [],
              video:
                i.item?.itemContent?.tweet_results?.result?.legacy?.entities?.media
                  ?.filter((m) => m.type === "video")
                  ?.map((m) => {
                    const info = m.video_info?.variants?.filter((v) => typeof v.bitrate === "number") || [];
                    return maxBy(info, (v) => v.bitrate!)?.url!;
                  }) ?? [],
            })) || [],
        });
      }
    });

    return result;
  }

  async getChannelVideos(channel: string) {
    const res = await getYoutubeByChannelNameVideos({ client: this.client, path: { channelName: channel } });
    return res.data;
  }
}
