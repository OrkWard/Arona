import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { OneBot } from "onebot";
import { createHash } from "node:crypto";
import "dotenv/config";

const onebot = new OneBot({ authKey: process.env.ONEBOT_AUTH_TOKEN, origin: process.env.ONEBOT_ORIGIN });
const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

onebot.onOpen(async () => {
  const msgList = await onebot.post("get_essence_msg_list", { group_id: Number(process.env.QQ_GROUP_ID) });

  const images: { id: string; url: string }[] = [];
  msgList.forEach((msg) => {
    msg.content = msg.content.map((seg) => {
      if (seg.type === "image") {
        const id = createHash("sha256").update(seg.data.url).digest("hex");
        images.push({ id, url: seg.data.url });
        seg.data.url = `https://r2.orkward.dev/${id}`;
      }
      return seg;
    });
  });

  console.info(`Start fetch and upload, count: ${images.length}`);

  await Promise.all(
    images.map(async ({ id, url }) => {
      if (
        await S3.send(
          new HeadObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: id,
          })
        ).then(
          () => true,
          (e) => false
        )
      ) {
        return;
      }

      const buffer = await fetch(url).then((resp) => resp.arrayBuffer());
      if (buffer.byteLength === 0) {
        console.warn(`[Get Image]: resp null, url: ${url}`);
        return;
      }
      const view = new Uint8Array(buffer, 0, 1);
      if (view[0] === "{".charCodeAt(0)) {
        console.warn(`[Get Image]: resp is json, content: ${new TextDecoder("utf-8").decode(buffer)}`);
        return;
      }

      await S3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: id,
          ContentType: "image/jpg",
          Body: Buffer.from(buffer),
        })
      );
    })
  );

  console.info("Start write file");
  const fileName = `./essence-${new Date().getTime()}.json`;
  const linkName = "./essence.json";
  writeFileSync(fileName, JSON.stringify(msgList, undefined, "  "));
  try {
    unlinkSync(linkName);
  } catch {}
  symlinkSync(fileName, linkName);

  console.info("Write essence success");

  onebot.close();
});
