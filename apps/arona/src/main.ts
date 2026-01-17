import "./util/sentry.js";
import { Arona } from "./arona.js";
import { createTwitterPlugin } from "./plugin/twitter.js";
import { createYouTubePlugin } from "./plugin/youtube.js";
import { PokePlugin } from "./plugin/poke.js";
import { AlivePlugin } from "./plugin/alive.js";
import { logger } from "./util/logger.js";

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const arona = new Arona({
  onebotOrigin: assertEnv("ONEBOT_ORIGIN"),
  onebotAuthToken: assertEnv("ONEBOT_AUTH_TOKEN"),
  redisUrl: assertEnv("REDIS"),
  assetsDir: assertEnv("STATIC_ROOT"),
  serverPort: parseInt(assertEnv("STATIC_PORT")),
  baseUrl: `http://${assertEnv("STATIC_HOST")}:${assertEnv("STATIC_PORT")}`,
  wormfaceOrigin: process.env.WORMFACE_ORIGIN ?? "http://localhost:8080",
});

arona.add("poke", PokePlugin);
arona.add("alive", AlivePlugin);

const qqGroupId = parseInt(assertEnv("QQ_GROUP_ID"));

arona.cron(
  "twitter",
  createTwitterPlugin({
    qqGroupId,
    twitterUsername: process.env.TWITTER_USERNAME ?? "Blue_ArchiveJP",
  })
);
arona.cron(
  "youtube",
  createYouTubePlugin({
    qqGroupId,
    youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID ?? "UCmgf8DJrAXFnU7j3u0kklUQ",
  })
);

arona.start();

logger.info("Arona started");
