import { copyFile } from "node:fs/promises";
import { onebot } from "../onebot.js";
import { logger } from "../util/logger.js";
import { AronaPlugin } from "./index.js";
import { join } from "node:path";
import { staticOrigin } from "./context.js";
import { C } from "../config.js";

export class Poke implements AronaPlugin {
  private listenerId: null | number = null;

  activate(): void {
    this.listenerId = onebot.on("notice", async (e) => {
      if (e.sub_type !== "poke") {
        return;
      }

      if (e.target_id === e.self_id) {
        const faceId = (Math.floor(Math.random() * 16) + 1).toString().padStart(2, "0");
        const fileName = `Operator_Portrait_Arona_${faceId}.png`;
        await copyFile(join(import.meta.dirname, "..", "..", "assets", fileName), join(C.STATIC_ROOT, fileName));

        onebot.post("send_group_msg", {
          group_id: e.group_id,
          message: [{ type: "image", data: { file: `${staticOrigin}/${fileName}` } }],
        });
      }
      logger.info("Arona was poked");
    });
  }

  deactivate(): void {
    if (this.listenerId) {
      onebot.removeListener("notice", this.listenerId);
    }
  }
}
