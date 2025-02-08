import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import "dotenv/config";
import { fromPromise, ok, okAsync, ResultAsync } from "neverthrow";
import { createWriteStream, existsSync, symlinkSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { arrayBuffer } from "node:stream/consumers";
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
    .map((data) => {
      const ids: string[] = [];
      data.forEach((msg) => {
        msg.content = msg.content.map((seg) => {
          if (seg.type === "image" && seg.data.url.includes("multimedia.nt.qq.com.cn")) {
            const id = seg.data.file;
            if (id) {
              ids.push(id);
              seg.data.url = `https://r2.orkward.dev/${id}.jpg`;
            }
          }
          return seg;
        });
      });

      logger.info(`start upload, count: ${ids.length}`);

      return [data, ids] as const;
    })
    .andThrough(([_, ids]) => {
      return ResultAsync.combine(ids.map((id) => onebot.post("get_image", { file_id: id })))
        .andThen((files) =>
          fromPromise(
            Promise.all(
              files.map(async (file) => {
                const buffer = await fetch(file.url).then((resp) => resp.arrayBuffer());
                if (buffer.byteLength === 0) {
                  throw new Error(`[Get Image]: resp null, file id: ${file.file_name}`);
                }
                const view = new Uint8Array(buffer, 0, 1);
                if (view[0] === "{".charCodeAt(0)) {
                  throw new Error(`[Get Image]: resp is json, content: ${new TextDecoder("utf-8").decode(buffer)}`);
                }
                return buffer;
              })
            ),
            (e) => {
              return new Error(`[Get Image]: ${e}`);
            }
          )
        )
        .andThen((buffer) =>
          fromPromise(
            Promise.all(
              ids.map(async (id, i) => {
                return S3.send(
                  new PutObjectCommand({
                    Bucket: "zju-ba-images",
                    Key: id,
                    ContentType: "image/jpg",
                    Body: Buffer.from(buffer[i]),
                  })
                );
              })
            ),
            (e) => {
              return new Error(`[Upload]: ${e}`);
            }
          )
        );
    })
    .map(([data]) => {
      const fileName = `./essence-${new Date().getTime()}.json`;
      const linkName = "./essence.json";
      writeFileSync(fileName, JSON.stringify(data, undefined, "  "));
      try {
        unlinkSync(linkName);
      } catch {}
      symlinkSync(fileName, linkName);
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
