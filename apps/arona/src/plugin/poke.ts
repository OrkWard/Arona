import { logger } from "../util/logger.js";
import { join } from "node:path";
import { OneBotNoticeEvent } from "onebot/src/event.js";
import { Effect } from "effect";
import { OneBotService } from "../core/services/onebot.js";
import { Random } from "effect/Random";
import { FileSystem } from "@effect/platform";
import { StaticService } from "../core/services/static.js";

export class PokePlugin {
  onNotice(e: OneBotNoticeEvent) {
    return Effect.gen(function* () {
      if (e.sub_type !== "poke") {
        return;
      }

      if (e.target_id === e.self_id) {
        const random = yield* Random;
        const fs = yield* FileSystem.FileSystem;
        const staticOrigin = yield* StaticService;

        const faceId = (Math.floor((yield* random.next) * 33) + 1).toString();
        const fileName = `Arona_${faceId}.png`;

        yield* fs.copyFile(
          join(import.meta.dirname, "..", "..", "assets", fileName),
          join(process.env.STATIC_ROOT, fileName)
        );

        const onebot = yield* OneBotService;
        yield* onebot.post("send_group_msg", {
          group_id: e.group_id,
          message: [{ type: "image", data: { file: `${staticOrigin.origin}/${fileName}` } }],
        });
      }

      logger.info("Arona was poked");
    });
  }
}
