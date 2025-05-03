import "./util/sentry.js";
import assert from "node:assert";
import * as Sentry from "@sentry/node";

import { C } from "./util/config.js";
import { logger } from "./util/logger.js";

assert(C.STATIC_HOST);
assert(C.ONEBOT_ORIGIN);
assert(C.REDIS);

setInterval(async () => {
  try {
  } catch (e) {
    Sentry.captureException(e);
    logger.error(e);
  }
}, 1000 * 5);
