import { Effect } from "effect";
import { got } from "got";

import { logger as parentLogger } from "../util/logger.js";
import { OneBotService, S3Service, MlService, DbService } from "../services/index.js";
import type { EventPlugin } from "../types.js";
import type { Message, OneBotMessageEvent } from "onebot";

const logger = parentLogger.child({ module: "mars" });
const { get } = got;

const COMMAND_REGEX = /^\/(火星|煋|old|mars|m)$/;

interface MarsPluginConfig {
  phashThreshold: number;
  pdqThreshold: number;
}

function processImage(imageUrl: string, config: MarsPluginConfig) {
  return Effect.gen(function* () {
    const s3 = yield* S3Service;
    const ml = yield* MlService;
    const db = yield* DbService;

    const buffer = yield* Effect.tryPromise({
      try: () => get(imageUrl).buffer(),
      catch: (e) => new Error(`Failed to download image: ${e}`),
    });

    const minioUrl = yield* s3.saveMedia(buffer, "jpg");

    const hashResponse = yield* ml.getImageHash({ url: minioUrl });

    const pdqhash = hashResponse.pdqhash;

    // Extract all PDQ hashes
    const pdqHashes = [
      pdqhash.original,
      pdqhash.rotated_90,
      pdqhash.rotated_180,
      pdqhash.rotated_270,
      pdqhash.flipped_vertical,
      pdqhash.flipped_horizontal,
      pdqhash.rotated_90_flipped,
      pdqhash.rotated_270_flipped,
    ];

    // Find similar images
    const similarImages = yield* db.findSimilarImages(
      {
        perceptualHash: hashResponse.perceptual_hash,
        pdqHashes: pdqHashes,
      },
      {
        phashThreshold: config.phashThreshold,
        pdqThreshold: config.pdqThreshold,
      }
    );

    if (similarImages.length === 0) {
      return null;
    }

    similarImages.forEach((img) => {
      const matchInfo = img.matchType === "phash" ? `pHash距离: ${img.phashDistance}` : `PDQ距离: ${img.pdqDistance}`;
      logger.info(`Match result for ${minioUrl}: ${matchInfo}`);
    });

    return {
      count: similarImages.length,
      // 找最旧的一条
      msg: similarImages.toSorted((a, b) => +a.ctime - +b.ctime)[0],
    };
  });
}

function sendReply(event: OneBotMessageEvent, text: string) {
  return Effect.gen(function* () {
    const onebot = yield* OneBotService;

    if (event.message_type === "group") {
      yield* onebot.post("send_group_msg", {
        group_id: event.group_id,
        message: [
          { type: "reply", data: { id: event.message_id.toString() } },
          { type: "text", data: { text } },
        ],
      });
    } else {
      yield* onebot.post("send_private_msg", {
        user_id: event.user_id,
        message: [{ type: "text", data: { text } }],
      });
    }
  });
}

function findReplySegment(message: Message) {
  return message.find((seg) => seg.type === "reply");
}

function findImageSegments(message: Message) {
  return message.filter((seg) => seg.type === "image");
}

function findTextSegment(message: Message) {
  return message.find((seg) => seg.type === "text");
}

/**
 * 火星探测仪：检查群友发的图是否火星！
 * @returns
 */
export function createMarsPlugin(config: MarsPluginConfig): EventPlugin {
  return {
    onMessage: (event) =>
      Effect.gen(function* () {
        const onebot = yield* OneBotService;

        const textSeg = findTextSegment(event.message);
        const match = textSeg?.data.text.trim().match(COMMAND_REGEX);
        if (!match) return;

        // 必须是对图片的回复
        const replySeg = findReplySegment(event.message);
        if (!replySeg) {
          yield* sendReply(event, "Arona 没有找到需要检测的目标！");
          return;
        }

        const repliedMsg = yield* onebot.post("get_msg", {
          message_id: parseInt(replySeg.data.id),
        });

        const imageSegs = findImageSegments(repliedMsg.message);
        if (imageSegs.length === 0) {
          yield* sendReply(event, "Arona 在目标消息中没有找到图片！");
          return;
        } else {
          yield* sendReply(event, `Arona 对${imageSegs.length}张图片进行检测……`);
        }

        const results: string[] = [];
        for (let i = 0; i < imageSegs.length; i++) {
          const imgSeg = imageSegs[i];
          if (imgSeg.type !== "image") continue;

          logger.info(`Processing image ${i + 1}/${imageSegs.length} for mars command`);

          const result = yield* processImage(imgSeg.data.url, config);
          if (!result) {
            results.push(`看起来第${i + 1}张图片没有人发过`);
          } else {
            results.push(
              `火星了！第${i + i}张图片最早由${result.msg.sender}在${result.msg.ctime.toLocaleDateString("zh-CN")}发过，已经被发过${result.count}次了`
            );
          }
        }

        yield* sendReply(event, results.join("\n\n"));
      }),
  };
}
