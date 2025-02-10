import "dotenv/config";
import { prepareAPI, type TweetLegacy } from "twitter-scraper";
import { decode } from "html-entities";

function getTweetContent(tweet: TweetLegacy) {
  const tweetId = tweet.id_str;
  const text = decode(tweet.full_text);
  const media = tweet.entities.media?.map((m) => m.media_url_https).filter((url) => typeof url === "string");
  return {
    tweetId,
    text,
    media,
  };
}

async function main() {
  const { getUserId, getUserTweets } = await prepareAPI({
    cookie: process.env.cookie,
    referer: `https://x.com/blue_archivejp/media`,
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "x-csrf-token": process.env["x-csrf-token"],
    Authorization: process.env.Authorization,
  });
  const id = await getUserId("blue_archivejp");
  const tweets = await getUserTweets(id);
  const latestTweet = tweets.find((t) => t.content?.entryType === "TimelineTimelineItem")?.content.itemContent
    .tweet_results.result.legacy;
  if (latestTweet) {
    console.log("OOO", getTweetContent(latestTweet));
  }

  // console.log(decode(latestTweet?.full_text));
}

main();
