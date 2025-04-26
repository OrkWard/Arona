import { getTweetMedia, prepareAPI, type TimelineTweetLegacy } from "twitter-scraper";
import { decode } from "html-entities";
import { C } from "./config.js";

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

async function prepare() {
  const { getUserId, getUserTweets } = await prepareAPI({
    cookie: C.cookie,
    referer: `https://x.com/blue_archivejp/media`,
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "x-csrf-token": C["x-csrf-token"],
    Authorization: C.Authorization,
  });

  return async () => {
    const id = await getUserId("blue_archivejp");
    const entries = await getUserTweets(id);
    const result = entries
      .filter((e) => ["TimelineTimelineItem", "TimelineTimelineModule"].includes(e.content.entryType))
      .map((e) =>
        e.content.entryType === "TimelineTimelineItem"
          ? e.content.itemContent
          : e.content.items.map((i) => i.item.itemContent).reverse()
      )
      .flat()
      .filter((t) => t.itemType === "TimelineTweet")
      .map((t) => t.tweet_results.result.legacy)
      .map(getTweetContent);
    if (!Array.isArray(result) || result.some((t) => typeof t.tweetId !== "string" || typeof t.text !== "string")) {
      throw new Error(`Parsed entries don't have expected structure, raw: ${JSON.stringify(result)}`);
    }
    return result;
  };
}

const getLast20TweetContent = await prepare();

export { getLast20TweetContent };
