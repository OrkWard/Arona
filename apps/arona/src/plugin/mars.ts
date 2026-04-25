import { got } from "got";

import { logger as parentLogger } from "../util/logger.js";
import type { Message, OneBotMessageEvent } from "onebot";
import { EventPlugin } from "../core/plugin.js";

const logger = parentLogger.child({ module: "mars" });
const { get } = got;

const COMMAND_REGEX = /^\/(火星|煋|晗|old|mars|m)$/;

// interface MarsPluginConfig {
//   phashThreshold: number;
//   pdqThreshold: number;
// }

const phashThreshold = 10;
const pdqThreshold = 10;

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
export class MarsPlugin extends EventPlugin {
  // 回复消息
  private async sendReply(event: OneBotMessageEvent, text: string) {
    if (event.message_type === "group") {
      await this.onebot.post("send_group_msg", {
        group_id: event.group_id,
        message: [
          { type: "reply", data: { id: event.message_id.toString() } },
          { type: "text", data: { text } },
        ],
      });
    } else {
      await this.onebot.post("send_private_msg", {
        user_id: event.user_id,
        message: [{ type: "text", data: { text } }],
      });
    }
  }

  // 处理图片
  private async processImage(currentMsgId: number, imageUrl: string, groupId: number) {
    const buffer = await get(imageUrl).buffer();
    const minioUrl = await this.s3.saveMedia(buffer, "jpg");
    const hashResponse = await this.ml.getImageHash(minioUrl);

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

    // Find similar images (excluding the current image itself)
    const similarImages = (
      await this.db.findSimilarImages(
        {
          perceptualHash: hashResponse.perceptual_hash,
          pdqHashes: pdqHashes,
          currentMsgId,
        },
        {
          phashThreshold: phashThreshold,
          pdqThreshold: pdqThreshold,
        }
      )
    ).filter((image) => image.group === groupId);

    if (similarImages.length === 0) {
      return null;
    }

    similarImages.forEach((img) => {
      const matchInfo = img.matchType === "phash" ? `pHash距离: ${img.phashDistance}` : `PDQ距离: ${img.pdqDistance}`;
      logger.info(`Match result for ${minioUrl}: ${matchInfo}, img: ${img.imageUrl}`);
    });

    return {
      count: similarImages.length,
      // 找最旧的一条
      msg: similarImages.toSorted((a, b) => +a.ctime - +b.ctime)[0],
      senders: similarImages.map((img) => img.sender),
    };
  }

  async onMessage(event: OneBotMessageEvent): Promise<void> {
    logger.debug({ msg: "Mars plugin received message", message: event.message });

    const textSeg = findTextSegment(event.message);
    const match = textSeg?.data.text.trim().match(COMMAND_REGEX);
    logger.debug({ msg: "Mars command check", text: textSeg?.data.text, match: !!match });
    if (!match) return;

    // 必须是对图片的回复
    const replySeg = findReplySegment(event.message);
    if (!replySeg) {
      await this.sendReply(event, "Arona 没有找到需要检测的目标！");
      return;
    }

    const repliedMsg = await this.onebot.post("get_msg", {
      message_id: parseInt(replySeg.data.id),
    });

    const imageSegs = findImageSegments(repliedMsg.message);
    if (imageSegs.length === 0) {
      await this.sendReply(event, "Arona 在目标消息中没有找到图片！");
      return;
    } else {
      await this.sendReply(event, `Arona 正在对${imageSegs.length}张图片进行检测……`);
    }

    const results: string[] = [];
    for (let i = 0; i < imageSegs.length; i++) {
      const imgSeg = imageSegs[i];
      if (imgSeg.type !== "image") continue;

      logger.info(`Processing image ${i + 1}/${imageSegs.length} for mars command`);

      const result = await this.processImage(repliedMsg.message_id, imgSeg.data.url, repliedMsg.group_id);
      if (!result) {
        results.push(`看起来第${i + 1}张图片以前没有老师发过`);
      } else {
        results.push(
          `火星了！第${i + 1}张图片最早由${result.msg.sender}在${result.msg.ctime.toLocaleString("zh-CN")}发过，已经被发过${result.count}次了` +
            (result.count > 1
              ? `（${Object.entries(
                  result.senders.reduce(
                    (acc, cur) => {
                      acc[cur] = (acc[cur] ?? 0) + 1;
                      return acc;
                    },
                    {} as Record<string, number>
                  )
                )
                  .map(([key, value]) => `${key}x${value}`)
                  .join("、")}都很喜欢这张图片）`
              : "")
        );
      }
    }

    await this.sendReply(event, results.join("\n\n"));
  }
}
