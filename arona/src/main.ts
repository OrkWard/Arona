import "./util/sentry.js";
import { TwitterPlugin } from "./plugin/twitter.js";
import { YouTubePlugin } from "./plugin/youtube.js";
import { onebot } from "./onebot.js";
import { logger } from "./util/logger.js";
import { AronaPlugin } from "./plugin/index.js";
import { C } from "./config.js";
import { Poke } from "./plugin/poke.js";

const plugins = new Map<string, AronaPlugin>([
  ["twitter", new TwitterPlugin()],
  ["youtube", new YouTubePlugin()],
  ["poke", new Poke()],
]);

async function activatePlugin(pluginName: string) {
  const plugin = plugins.get(pluginName);
  if (!plugin) {
    logger.error(`Plugin ${pluginName} not found`);
    return;
  }
  plugin.activate();
  logger.info(`Plugin ${pluginName} activated`);
}

async function deactivatePlugin(pluginName: string) {
  const plugin = plugins.get(pluginName);
  if (!plugin) {
    logger.error(`Plugin ${pluginName} not found`);
    return;
  }
  plugin.deactivate();
  logger.info(`Plugin ${pluginName} deactivated`);
}

onebot.onMessage((msg) => {
  let command = "";
  if (
    !Array.isArray(msg.message) ||
    !msg.message[0]?.type ||
    !(msg.message[0].type === "text") ||
    !msg.message[0].data.text.startsWith("/")
  ) {
    return;
  }
  command = msg.message[0].data.text.slice(1);
  if (msg.sender.user_id !== C.ADMIN_ID) {
    logger.warn(`User ${msg.sender.user_id} send a command, ignore`);
    return;
  }

  const commands = command.split(" ");
  switch (commands[0]) {
    case "d":
      deactivatePlugin(commands[1]);
      break;
    case "a":
      activatePlugin(commands[1]);
      break;
  }
});

logger.info("Arona started");
activatePlugin("poke");
