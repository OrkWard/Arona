import { Effect } from "effect";
import { got } from "got";

import { logger as parentLogger } from "../util/logger.js";
import { S3Service, MlService, DbService } from "../services/index.js";
import type { EventPlugin } from "../types.js";
import type { OneBotMessageEvent } from "onebot";

const logger = parentLogger.child({ module: "backup" });
const { get } = got;

/**
 * 备份群聊的消息
 * @returns
 */
export function createBackupPlugin(): EventPlugin {
  return {
    onMessage: (event) =>
      Effect.gen(function* () {
        let segmentIndex = 0;
        for (const segment of event.message) {
          if (segment.type === "text") {
            yield* processTextMessage(event, segment.data.text, segmentIndex).pipe(
              Effect.catchAll((e) =>
                Effect.sync(() => logger.error({ msg: "Failed to process text", error: e.message, stack: e.stack }))
              )
            );
          } else if (segment.type === "image") {
            yield* processImageMessage(event, segment.data.url, segmentIndex).pipe(
              Effect.catchAll((e) =>
                Effect.sync(() => logger.error({ msg: "Failed to process image", error: e.message, stack: e.stack }))
              )
            );
          }

          segmentIndex++;
        }
      }),
  };
}

function processTextMessage(event: OneBotMessageEvent, text: string, segmentIndex: number) {
  return Effect.gen(function* () {
    const db = yield* DbService;
    const messageId = `${event.message_id}-${segmentIndex}`;
    if (event.message_type !== "group") return;

    yield* db.saveMessage({
      messageId,
      rawMessageId: event.message_id,
      segmentIndex,
      groupId: event.group_id,
      senderId: event.sender.user_id,
      sender: event.sender.nickname,
      type: "text",
      content: text,
    });

    logger.debug({ msg: "Text message saved", messageId });
  });
}

function processImageMessage(event: OneBotMessageEvent, imageUrl: string, segmentIndex: number) {
  return Effect.gen(function* () {
    if (event.message_type !== "group") return;
    const s3 = yield* S3Service;
    const ml = yield* MlService;
    const db = yield* DbService;

    const messageId = `${event.message_id}-${segmentIndex}`;

    const buffer = yield* Effect.tryPromise({
      try: () => get(imageUrl).buffer(),
      catch: (e) => new Error(`Failed to download image: ${e}`),
    });

    const minioUrl = yield* s3.saveMedia(buffer, "jpg");
    logger.debug({ msg: "Image uploaded to Minio", messageId, url: minioUrl });

    const hashResponse = yield* ml.getImageHash({ url: minioUrl });
    logger.debug({ msg: "Image hash computed", messageId, phash: hashResponse.perceptual_hash });

    const pdqhash = hashResponse.pdqhash;

    // Save to database
    yield* db.saveMessage({
      messageId,
      rawMessageId: event.message_id,
      segmentIndex,
      groupId: event.group_id,
      senderId: event.sender.user_id,
      sender: event.sender.nickname,
      type: "image",
      content: imageUrl, // Original URL
      imageUrl: minioUrl, // Minio URL
      perceptualHash: hashResponse.perceptual_hash,
      pdqHashOriginal: pdqhash.original,
      pdqHashQuality: pdqhash.quality,
    });

    logger.info({ msg: "Image message saved", messageId, phash: hashResponse.perceptual_hash });
  });
}
