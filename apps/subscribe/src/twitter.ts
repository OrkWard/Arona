import { getTweetMedia, prepareAPI, type TimelineTweetLegacy } from "twitter-scraper";
import { decode } from "html-entities";
import { config } from "dotenv";
import { findUpSync } from "find-up";

config({ path: findUpSync(".env") });

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
    cookie: process.env.cookie,
    referer: `https://x.com/blue_archivejp/media`,
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "x-csrf-token": process.env["x-csrf-token"],
    Authorization: process.env.Authorization,
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

let client = prepare();

async function getLast20TweetContent() {
  const f = await client;
  return await f();
}

async function getLastTweetContent() {
  const f = await client;
  const tweets = await f(0);
  return tweets;
}

async function getTweetContentAt(idx: number) {
  const f = await client;
  const tweets = await f(idx);
  return tweets;
}

export { getLast20TweetContent, getLastTweetContent, getTweetContentAt };
