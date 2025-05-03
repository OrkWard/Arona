import "./util/sentry.js";
import * as Sentry from "@sentry/node";

import { logger } from "./util/logger.js";
import { subscribeTwitter, subscribeYoutube } from "./task.js";

setInterval(async () => {
  try {
    subscribeTwitter();
    subscribeYoutube();
  } catch (e) {
    Sentry.captureException(e);
    logger.error(e);
  }
}, 1000 * 5);
