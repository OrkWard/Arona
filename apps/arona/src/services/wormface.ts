import { createClient } from "../codegen/wormface/client/client.gen.js";
import { Client } from "../codegen/ml/client/types.gen.js";
import { getTwitterByUserNamePosts, getYoutubeByChannelNameVideos } from "../codegen/wormface/index.js";
import { AppConfig } from "./config.js";

export class WormfaceService {
  static inject = ["config"] as const;

  private _client?: Client;
  constructor(private config: AppConfig) {}

  get client(): Client {
    if (this._client) return this._client;

    const c = createClient({ baseUrl: this.config.wormfaceOrigin });
    this._client = c;
    return c;
  }

  async getUserPosts(username: string) {
    // TODO: config client to throw on error, not return
    const res = await getTwitterByUserNamePosts({ client: this.client, path: { userName: username } });
    const result = [] as { text?: string; media?: string[]; id: string }[];
    res.data.forEach((tweet) => {
      if (tweet.content?.entryType === "TimelineTimelineItem") {
        result.push({
          id: tweet.entryId!,
          text: tweet.content.itemContent?.tweet_results?.result?.legacy?.full_text,
          media: tweet.content.itemContent?.tweet_results?.result?.legacy?.entities?.media?.map(
            (m) => m.media_url_https!
          ),
        });
      } else if (tweet.content?.entryType === "TimelineTimelineModule") {
        result.push(
          ...(tweet.content?.items?.map((i) => ({
            id: i.entryId!,
            text: i.item?.itemContent?.tweet_results?.result?.legacy?.full_text,
            media: i.item?.itemContent?.tweet_results?.result?.legacy?.entities?.media?.map((m) => m.media_url_https!),
          })) || [])
        );
      }
    });

    return result;
  }

  async getChannelVideos(channel: string) {
    const res = await getYoutubeByChannelNameVideos({ client: this.client, path: { channelName: channel } });
    return res.data;
  }
}
