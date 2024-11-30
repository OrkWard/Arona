import { OneBot } from "./OneBot/index.js";

class Arona {
  private oneBot: OneBot;

  constructor(oneBot: OneBot) {
    this.oneBot = oneBot;
    this.oneBot.listen("message", (e) => {
      e;
    });
  }
}
