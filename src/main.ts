import "reflect-metadata";
import "dotenv";
import { Arona } from "./Arona.js";
import { Container } from "typedi";
import { OneBotConfig } from "./OneBot/index.js";

(function () {
  Container.set(OneBotConfig, { authKey: process.env.AUTH_TOKEN!, origin: "sur4:3001" } satisfies OneBotConfig);
  const arona = Container.get(Arona);

  process.on("SIGINT", () => {
    arona.exit();
    process.exit();
  });
})();
