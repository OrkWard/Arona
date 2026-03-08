import "./util/sentry.js";
import { Arona } from "./arona.js";
import { createTwitterPlugin } from "./plugin/twitter.js";
// import { createYouTubePlugin } from "./plugin/youtube.js";
import { createPokePlugin } from "./plugin/poke.js";
import { createAlivePlugin } from "./plugin/alive.js";
import { createMarsPlugin } from "./plugin/mars.js";
import { createBackupPlugin } from "./plugin/backup.js";

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseGroupIds(value: string): number | number[] {
  if (value.includes(",")) {
    return value.split(",").map((id) => Number(id.trim()));
  }
  return Number(value);
}

const groupId = parseGroupIds(assertEnv("QQ_GROUP_ID"));

const arona = new Arona({
  onebotOrigin: assertEnv("ONEBOT_ORIGIN"),
  onebotAuthToken: assertEnv("ONEBOT_AUTH_TOKEN"),
  s3Endpoint: assertEnv("MINIO_ENDPOINT"),
  s3Ak: assertEnv("MINIO_AK"),
  s3Sk: assertEnv("MINIO_SK"),
  adminId: Number(assertEnv("QQ_ADMIN_ID")),
  groupId,
  redisUrl: assertEnv("REDIS"),
  wormfaceOrigin: assertEnv("WORMFACE_ORIGIN"),
  mlOrigin: assertEnv("MACHINE_LEARNING_ORIGIN"),
  mongoUrl: assertEnv("MONGO_URL"),
});

arona.add("poke", createPokePlugin());
arona.add("alive", createAlivePlugin());
arona.add(
  "mars",
  createMarsPlugin({
    phashThreshold: Number(process.env["PHASH_THRESHOLD"] ?? "10"),
    pdqThreshold: Number(process.env["PDQ_THRESHOLD"] ?? "10"),
  })
);
arona.add("backup", createBackupPlugin());
arona.cron("twitter", createTwitterPlugin({ twitterUsername: "Blue_ArchiveJP", groupId }));
// arona.cron("youtube", createYouTubePlugin({ qqGroupId, youtubeChannelId: "UCmgf8DJrAXFnU7j3u0kklUQ" }), false);

arona.start();
