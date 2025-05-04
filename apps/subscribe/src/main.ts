import "./util/sentry.js";
import * as Sentry from "@sentry/node";

import { logger } from "./util/logger.js";
import { subscribeTwitter, subscribeYoutube } from "./task.js";

function createTask(func: () => Promise<void>) {
  let isRunning = false;
  async function safeCall() {
    if (isRunning) {
      logger.warn(`Skipping execution of ${func.name} because it's already running.`);
      return;
    }

    try {
      isRunning = true;
      await func();
    } catch (error) {
      Sentry.captureException(error);
      logger.error(error, `Error happen in ${func.name}`);
    } finally {
      isRunning = false;
    }
  }

  return () => {
    safeCall();
    return setInterval(safeCall, 1000 * 5);
  };
}

createTask(subscribeTwitter)();
createTask(subscribeYoutube)();
