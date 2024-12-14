import { Arona } from "./Arona.js";
import { logger } from "./utils/log.js";
import "dotenv";

(function () {
  const arona = new Arona();

  process.on("SIGINT", () => {
    logger.info("Exiting...");
    arona.exit();
    process.exit();
  });
})();
