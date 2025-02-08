import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import "dotenv/config";
import { createWriteStream, existsSync, symlinkSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
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

onebot.onOpen(async () => {
  const msgList = await onebot.post("get_essence_msg_list", { group_id: 663985246 });
  /** Need to manually fetch the file */
  const ids: string[] = [];
  msgList.forEach((msg) => {
    msg.content = msg.content.map((seg) => {
      if (seg.type === "image" && seg.data.url.includes("multimedia.nt.qq.com.cn")) {
        const id = seg.data.file;
        if (id) {
          ids.push(id);
          seg.data.url = `https://r2.orkward.dev/${id}`;
        }
      }
      return seg;
    });
  });

  logger.info(`Start fetch and upload, count: ${ids.length}`);

  await Promise.all(
    ids.map(async (id) => {
      const fileDesc = await onebot.post("get_image", { file_id: id });
      const buffer = await fetch(fileDesc.url).then((resp) => resp.arrayBuffer());
      if (buffer.byteLength === 0) {
        throw new Error(`[Get Image]: resp null, file name: ${fileDesc.file_name}`);
      }
      const view = new Uint8Array(buffer, 0, 1);
      if (view[0] === "{".charCodeAt(0)) {
        throw new Error(`[Get Image]: resp is json, content: ${new TextDecoder("utf-8").decode(buffer)}`);
      }

      await S3.send(
        new PutObjectCommand({
          Bucket: "zju-ba-images",
          Key: id,
          ContentType: "image/jpg",
          Body: Buffer.from(buffer),
        })
      );
    })
  );

  logger.info("Start write file");
  const fileName = `./essence-${new Date().getTime()}.json`;
  const linkName = "./essence.json";
  writeFileSync(fileName, JSON.stringify(msgList, undefined, "  "));
  try {
    unlinkSync(linkName);
  } catch {}
  symlinkSync(fileName, linkName);

  logger.info("Write essence success");

  onebot.close();
});
