import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import "dotenv/config";
import { fromPromise, ok, okAsync } from "neverthrow";
import { existsSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { Logger, OneBot } from "onebot";

const logger = new Logger({ debug: Boolean(process.env.DEBUG) || false });
const onebot = new OneBot(logger, {
  authKey: process.env.AUTH_TOKEN!,
  origin: "sur4:3001",
});
const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.ACCESS_KEY_ID!,
    secretAccessKey: process.env.SECRET_ACCESS_KEY!,
  },
});

onebot.onOpen(() => {
  onebot
    .post("get_essence_msg_list", { group_id: 663985246 })
    .andThen((data) => {
      const objects: { url: string; id: string }[] = [];
      data.forEach((msg) => {
        msg.content = msg.content.map((seg) => {
          if (seg.type === "image" && seg.data.url.includes("multimedia.nt.qq.com.cn")) {
            const id = new URL(seg.data.url).searchParams.get("fileid");
            if (!id) {
              return seg;
            }

            objects.push({ id, url: seg.data.url });
            seg.data.url = `https://r2.orkward.dev/${id}`;
            return seg;
          }
          return seg;
        });
      });

      logger.info(`start upload, count: ${objects.length}`);

      return fromPromise(
        Promise.all(
          objects.map(async (o) =>
            S3.send(
              new PutObjectCommand({
                Bucket: "zju-ba-images",
                Key: o.id,
                Body: await fetch(o.url)
                  .then((rs) => rs.arrayBuffer())
                  .then((ab) => Buffer.from(ab)),
              })
            )
          )
        ).then(() => data),
        (e) => {
          return new Error(`[Upload]: ${e}`);
        }
      );
    })
    .map((data) => {
      const fileName = `./essence-${new Date().getTime()}.json`;
      const linkName = "./essence.json";
      writeFileSync(fileName, JSON.stringify(data, undefined, "  "));
      if (existsSync(linkName)) {
        unlinkSync(linkName);
      }
      symlinkSync(linkName, fileName);
    })
    .match(
      () => {
        logger.info("Write Essence Success");
      },
      (e) => {
        logger.error(e);
      }
    )
    .finally(() => {
      onebot.close();
    });
});
