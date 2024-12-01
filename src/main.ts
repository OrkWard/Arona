import { Arona } from "./Arona.js";
import { logger } from "./utils/log.js";

(function () {
  const arona = new Arona();
  process.on("SIGINT", () => {
    logger.info("Exiting...");
    arona;
    process.exit();
  });
})();
