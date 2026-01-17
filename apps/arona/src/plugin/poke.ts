import { Effect } from "effect";
import { Random } from "effect/Random";

import { logger } from "../util/logger.js";
import { OneBotService, MediaService } from "../services/index.js";
import type { EventPlugin } from "../types.js";

export const PokePlugin: EventPlugin = {
  onNotice: (event) =>
    Effect.gen(function* () {
      if (event.sub_type !== "poke") {
        return;
      }

      if (event.target_id === event.self_id) {
        const random = yield* Random;
        const media = yield* MediaService;
        const onebot = yield* OneBotService;

        const faceId = (Math.floor((yield* random.next) * 33) + 1).toString();
        const fileName = `Arona_${faceId}.png`;

        const url = media.getAssetUrl(fileName);

        yield* onebot.post("send_group_msg", {
          group_id: event.group_id,
          message: [{ type: "image", data: { file: url } }],
        });

        logger.info("Arona was poked");
      }
    }),
};
