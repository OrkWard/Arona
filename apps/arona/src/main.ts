import "./util/sentry.js";
import { createInjector } from "typed-inject";
import { OneBot } from "onebot";
import { logger } from "./util/logger.js";

import { Arona } from "./core/arona.js";
import { AppConfig } from "./services/config.js";
import { RedisService } from "./services/redis.js";
import { WormfaceService } from "./services/wormface.js";
import { MlService } from "./services/ml.js";
import { DbService } from "./services/db.js";
import { S3Service } from "./services/media.js";

import { TwitterPlugin } from "./plugin/twitter.js";
// import { createYouTubePlugin } from "./plugin/youtube.js";
import { PokePlugin } from "./plugin/poke.js";
import { AlivePlugin } from "./plugin/alive.js";
import { MarsPlugin } from "./plugin/mars.js";
import { BackupPlugin } from "./plugin/backup.js";
import { migrate } from "./migrate.js";

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

const config = {
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
} satisfies AppConfig;

const onebot = new OneBot(config.onebotOrigin, config.onebotAuthToken, logger.child({ module: "onebot" }));

const container = createInjector()
  .provideValue("config", config)
  .provideValue("onebot", onebot)
  .provideClass("redis", RedisService)
  .provideClass("wormface", WormfaceService)
  .provideClass("ml", MlService)
  .provideClass("db", DbService)
  .provideClass("s3", S3Service);

// migrate
if (process.argv.includes("migrate")) {
  await container
    .injectFunction(migrate)
    .then(() => {
      console.log("Migrate success");
      process.exit(0);
    })
    .catch((e) => {
      console.error("Migrate fail");
      console.error(e);
      process.exit(1);
    });
}

const arona = container.injectClass(Arona);

arona.add("poke", container.injectClass(PokePlugin));
arona.add("alive", container.injectClass(AlivePlugin));
arona.add("mars", container.injectClass(MarsPlugin));
arona.add("backup", container.injectClass(BackupPlugin));
arona.cron("twitter", container.injectClass(TwitterPlugin));
// arona.cron("youtube", createYouTubePlugin({ qqGroupId, youtubeChannelId: "UCmgf8DJrAXFnU7j3u0kklUQ" }), false);

arona.start();
