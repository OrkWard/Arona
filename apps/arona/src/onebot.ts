import { OneBot } from "onebot";

import { logger } from "./util/logger.js";

export const onebot = new OneBot({ authKey: process.env.ONEBOT_AUTH_TOKEN, origin: process.env.ONEBOT_ORIGIN, logger });
