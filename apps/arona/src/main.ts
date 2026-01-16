import "./util/sentry.js";
import { Arona } from "./core/arona.js";
import { TwitterPlugin } from "./plugin/twitter.js";
import { YouTubePlugin } from "./plugin/youtube.js";
import { logger } from "./util/logger.js";
import { PokePlugin } from "./plugin/poke.js";
import { AlivePlugin } from "./plugin/alive.js";

const arona = new Arona();
arona.add(TwitterPlugin, { enable: true });
arona.add(YouTubePlugin);
arona.add(PokePlugin, { enable: true });
Arona.add(AlivePlugin, { enable: true });

logger.info("Arona started");
