import "./util/sentry.js";
import * as Sentry from "@sentry/node";

import { logger } from "./util/logger.js";
import { subscribeTwitter, subscribeYoutube } from "./task.js";

function createTask(func: () => void) {
  function safeCall() {
    try {
      func();
    } catch (error) {
      Sentry.captureException(error);
      logger.error(error, `Error happen in ${func.name}`);
    }
  }

  return () => {
    safeCall();
    return setInterval(safeCall, 1000 * 5);
  };
}

createTask(subscribeTwitter)();
createTask(subscribeYoutube)();
