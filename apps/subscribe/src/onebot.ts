import { OneBot } from "onebot";
import { C } from "./util/config.js";
import { logger } from "./util/logger.js";

export const onebot = new OneBot({ authKey: C.ONEBOT_AUTH_TOKEN, origin: C.ONEBOT_ORIGIN, logger });
