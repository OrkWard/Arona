import ky from "ky";
import { logger as parentLogger } from "../util/logger.js";
import type { OneBotMessageEvent } from "onebot";
import { EventPlugin } from "../core/plugin.js";

const logger = parentLogger.child({ module: "backup" });

/**
 * 备份群聊的消息
 * @returns
 */
export class BackupPlugin extends EventPlugin {
  private async processTextMessage(event: OneBotMessageEvent, text: string, segmentIndex: number) {
    if (event.message_type !== "group") return;

    const messageId = event.message_id;
    await this.db.saveMessage({
      messageId,
      segmentIndex,
      groupId: event.group_id,
      senderId: event.sender.user_id,
      sender: event.sender.card || event.sender.nickname,
      type: "text",
      content: text,
    });

    logger.debug({ msg: "Text message saved", messageId, segmentIndex });
  }

  private async processImageMessage(event: OneBotMessageEvent, imageUrl: string, segmentIndex: number) {
    if (event.message_type !== "group") return;

    const messageId = event.message_id;
    const buffer = await ky.get(imageUrl).arrayBuffer();
    const minioUrl = await this.s3.saveMedia(Buffer.from(buffer), "jpg");
    logger.debug({ msg: "Image uploaded to Minio", messageId, url: minioUrl });

    const hashResponse = await this.ml.getImageHash(minioUrl);
    logger.debug({ msg: "Image hash computed", messageId, phash: hashResponse.perceptual_hash });

    const pdqhash = hashResponse.pdqhash;

    // Save to database
    this.db.saveMessage({
      messageId,
      segmentIndex,
      groupId: event.group_id,
      senderId: event.sender.user_id,
      sender: event.sender.card || event.sender.nickname,
      type: "image",
      content: imageUrl, // Original URL
      imageUrl: minioUrl, // Minio URL
      perceptualHash: Buffer.from(hashResponse.perceptual_hash, "hex"),
      pdqHashOriginal: Buffer.from(pdqhash.original, "hex"),
      pdqHashQuality: pdqhash.quality,
    });

    logger.info({ msg: "Image message saved", messageId, segmentIndex, phash: hashResponse.perceptual_hash });
  }

  async onMessage(event: OneBotMessageEvent) {
    let segmentIndex = 0;
    for (const segment of event.message) {
      if (segment.type === "text") {
        this.processTextMessage(event, segment.data.text, segmentIndex).catch((e) => {
          throw new Error("Failed to process text", { cause: e });
        });
      } else if (segment.type === "image") {
        this.processImageMessage(event, segment.data.url, segmentIndex).catch((e) => {
          throw new Error("Failed to process image", { cause: e });
        });
      }

      segmentIndex++;
    }
  }
}
