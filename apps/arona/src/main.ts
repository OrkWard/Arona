import "./util/sentry.js";
import { Arona } from "./arona.js";
import { createTwitterPlugin } from "./plugin/twitter.js";
import { createYouTubePlugin } from "./plugin/youtube.js";
import { PokePlugin } from "./plugin/poke.js";
import { AlivePlugin } from "./plugin/alive.js";

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
  s3Endpoint: assertEnv("MINIO_ENDPOINT"),
  s3Ak: assertEnv("MINIO_AK"),
  s3Sk: assertEnv("MINIO_SK"),
  adminId: Number(assertEnv("QQ_ADMIN_ID")),
  redisUrl: assertEnv("REDIS"),
  wormfaceOrigin: assertEnv("WORMFACE_ORIGIN"),
});

arona.add("poke", PokePlugin);
arona.add("alive", AlivePlugin);

const qqGroupId = parseInt(assertEnv("QQ_GROUP_ID"));

arona.cron("twitter", createTwitterPlugin({ qqGroupId, twitterUsername: "Blue_ArchiveJP" }));
arona.cron("youtube", createYouTubePlugin({ qqGroupId, youtubeChannelId: "UCmgf8DJrAXFnU7j3u0kklUQ" }), false);

arona.start();
