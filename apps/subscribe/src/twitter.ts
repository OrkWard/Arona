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

  return async (idx?: number) => {
    const id = await getUserId("blue_archivejp");
    const entries = await getUserTweets(id);
    return entries
      .filter((e) => ["TimelineTimelineItem", "TimelineTimelineModule"].includes(e.content.entryType))
      .filter((e, i) => (typeof idx === "number" ? idx === i : true))
      .map((e) =>
        e.content.entryType === "TimelineTimelineItem"
          ? e.content.itemContent
          : e.content.items.map((i) => i.item.itemContent)
      )
      .flat()
      .filter((t) => t.itemType === "TimelineTweet")
      .map((t) => t.tweet_results.result.legacy)
      .map(getTweetContent);
  };
}

const getLast20TweetContent = await prepare();

async function getLastTweetContent() {
  const tweets = await getLast20TweetContent(0);
  return tweets;
}

async function getTweetContentAt(idx: number) {
  const tweets = await getLast20TweetContent(idx);
  return tweets;
}

export { getLast20TweetContent, getLastTweetContent, getTweetContentAt };
