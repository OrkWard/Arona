import { logger } from "../util/logger.js";
import { EventPlugin } from "../core/plugin.js";
import { OneBotNoticeEvent } from "onebot";

/** 响应 poke 事件，在群聊中发送一张随机的表情 */
export class PokePlugin extends EventPlugin {
  async onNotice(event: OneBotNoticeEvent) {
    if (event.sub_type !== "poke") {
      return;
    }

    if (event.target_id === event.self_id) {
      const faceId = (Math.floor(Math.random() * 33) + 1).toString();
      const fileName = `Arona_${faceId}.png`;

      const url = this.s3.getStickerUrl(fileName);

      await this.onebot.post("send_group_msg", {
        group_id: event.group_id,
        message: [{ type: "image", data: { file: url } }],
      });

      logger.info("Arona was poked");
    }
  }
}
