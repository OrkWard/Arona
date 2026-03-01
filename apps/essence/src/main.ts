import { createHash } from "node:crypto";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { OneBot } from "onebot";
import { newQueue } from "@henrygd/queue";

// ======================== Functions ==========================
function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function headObject(id: string) {
  try {
    await S3.send(new HeadObjectCommand({ Bucket: bucket, Key: id }));
    return true;
  } catch {
    return false;
  }
}

async function pubObject(id: string, buffer: ArrayBuffer, type = "image/jpg") {
  await S3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: id,
      ContentType: type,
      Body: Buffer.from(buffer),
    })
  );

  return `${endpoint}/${bucket}/${id}`;
}

// ======================= Env ==========================
const endpoint = assertEnv("MINIO_ENDPOINT");
const ak = assertEnv("MINIO_AK");
const sk = assertEnv("MINIO_SK");
const bucket = "essence";
const onebot_origin = assertEnv("ONEBOT_ORIGIN");
const auth = assertEnv("ONEBOT_AUTH_TOKEN");
const group = Number(assertEnv("QQ_GROUP_ID"));

// ====================== globals =====================
const S3 = new S3Client({
  region: "auto",
  endpoint: endpoint,
  credentials: {
    accessKeyId: ak,
    secretAccessKey: sk,
  },
  forcePathStyle: true,
});
const queue = newQueue(5);
const encoder = new TextEncoder();
const onebot = new OneBot(onebot_origin, auth);

// ===================== main ====================
onebot.start();
onebot.on("meta_event", async () => {
  const essenceList = await onebot.post("get_essence_msg_list", { group_id: group });
  const essenceMsgs = await queue
    .all(essenceList.map((e) => onebot.post("get_msg", { message_id: e.message_id })))
    .then(async (l) => Promise.all(l.map((m) => onebot.post("get_msg", { message_id: m.message_id }))));

  const images: { id: string; url: string }[] = [];
  essenceMsgs.forEach((msg) => {
    msg.message.map((seg) => {
      if (seg.type === "image") {
        const id = createHash("sha256").update(seg.data.url).digest("hex");
        images.push({ id, url: seg.data.url });
        seg.data.url = `${endpoint}/${bucket}/${id}`;
      }
      return seg;
    });
  });

  console.info(`Start fetch and upload, count: ${images.length}`);

  await queue.all(
    images.map(async ({ id, url }) => {
      // 去重
      if (await headObject(id)) {
        return;
      }

      const buffer = await fetch(url).then((resp) => resp.arrayBuffer());
      // 空文件
      if (buffer.byteLength === 0) {
        console.warn(`[Get Image]: resp null, url: ${url}`);
        return;
      }

      // JSON 返回
      const view = new Uint8Array(buffer, 0, 1);
      if (view[0] === "{".charCodeAt(0)) {
        console.warn(`[Get Image]: resp is json, content: ${new TextDecoder("utf-8").decode(buffer)}`);
        return;
      }

      await pubObject(id, buffer);
    })
  );

  console.info("Start write file");
  console.info(
    "result: ",
    await pubObject(
      `${new Date().getTime()}-snapshot.txt`,
      encoder.encode(JSON.stringify(essenceMsgs, undefined, "  ")).buffer,
      "text/plain; charset=utf-8"
    )
  );

  onebot.close();
});
