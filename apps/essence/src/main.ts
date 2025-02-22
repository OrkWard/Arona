import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import "dotenv/config";
import { createWriteStream, existsSync, symlinkSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { OneBot } from "onebot";
import { Logger } from "common";

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
  const images: { id: string; url: string }[] = [];
  msgList.forEach((msg) => {
    msg.content = msg.content.map((seg) => {
      if (seg.type === "image") {
        const id = crypto.randomUUID();
        images.push({ id, url: seg.data.url });
        seg.data.url = `https://r2.orkward.dev/${encodeURIComponent(id)}`;
      }
      return seg;
    });
  });

  logger.info(`Start fetch and upload, count: ${images.length}`);

  await Promise.all(
    images.map(async ({ id, url }) => {
      const buffer = await fetch(url).then((resp) => resp.arrayBuffer());
      if (buffer.byteLength === 0) {
        logger.warn(`[Get Image]: resp null, url: ${url}`);
        return;
      }
      const view = new Uint8Array(buffer, 0, 1);
      if (view[0] === "{".charCodeAt(0)) {
        logger.warn(`[Get Image]: resp is json, content: ${new TextDecoder("utf-8").decode(buffer)}`);
        return;
      }

      await S3.send(
        new PutObjectCommand({
          Bucket: "zju-ba-images",
          Key: encodeURIComponent(id),
          ContentType: "image/jpg",
          Body: Buffer.from(buffer),
        })
      );
      // const bytes = Uint8Array.from(atob(fileDesc.base64), (c) => c.charCodeAt(0));
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
