import { randomInt } from "node:crypto";
import type { Message, OneBotMessageEvent } from "onebot";
import { EventPlugin } from "../core/plugin.js";
import { logger as parentLogger } from "../util/logger.js";

const logger = parentLogger.child({ module: "roast" });
const COMMAND_REGEX = /^\/(?:rp|锐评)$/;

export interface AronaQuote {
  id: string;
  text: string;
  episode: number;
  start: number;
  end: number;
  official_url: string;
  bilibili_url: string;
  flags?: string[];
}

type QuoteCorpus = {
  count: number;
  quotes: AronaQuote[];
};

export function isRoastCommand(message: Message) {
  return message.some((segment) => segment.type === "text" && COMMAND_REGEX.test(segment.data.text.trim()));
}

export class RoastPlugin extends EventPlugin {
  private quotesPromise?: Promise<AronaQuote[]>;

  private async sendReply(event: Extract<OneBotMessageEvent, { message_type: "group" }>, text: string) {
    await this.onebot.post("send_group_msg", {
      group_id: event.group_id,
      message: [
        { type: "reply", data: { id: event.message_id.toString() } },
        { type: "text", data: { text } },
      ],
    });
  }

  private loadQuotes() {
    if (!this.quotesPromise) {
      this.quotesPromise = fetch(this.config.aronaQuotesUrl, { signal: AbortSignal.timeout(30_000) })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Quote corpus request failed with HTTP ${response.status}`);
          return ((await response.json()) as QuoteCorpus).quotes;
        })
        .catch((error) => {
          this.quotesPromise = undefined;
          throw error;
        });
    }
    return this.quotesPromise;
  }

  async onMessage(event: OneBotMessageEvent): Promise<void> {
    if (event.message_type !== "group" || !isRoastCommand(event.message)) return;

    const reply = event.message.find((segment) => segment.type === "reply");
    if (!reply) {
      await this.sendReply(event, "Arona 没有看到这条消息！");
      return;
    }

    const target = await this.onebot.post("get_msg", { message_id: Number(reply.data.id) });
    if (target.message.some((segment) => segment.type === "image")) {
      await this.sendReply(event, "Arona 还不能看图片哦");
      return;
    }

    const context = await this.db.getMessageContext(event.group_id, target.message_id, 50);
    if (!context.some((message) => message.isTarget)) {
      await this.sendReply(event, "Arona 已经忘记老师们聊过什么了");
      return;
    }

    try {
      const quotes = await this.loadQuotes();
      const decision = await this.jev.chooseBatchWinners({
        state: {
          previous_messages: context
            .filter((message) => !message.isTarget)
            .map((message) => ({ sender: message.sender, text: message.content })),
          target_message: {
            sender: target.sender.nickname,
            text: target.raw_message,
          },
        },
        instructions: "结合前文和目标消息，选择一句最适合作为锐评回复的阿罗娜中文原句。应贴合语境、自然且有趣。",
        candidates: quotes.map((quote) => ({ id: quote.id, description: quote.text, value: quote })),
      });

      logger.info({
        msg: "Arona roast batch winners",
        winners: decision.winners.map((winner) => ({
          quoteId: winner.value.id,
          text: winner.value.text,
          episode: winner.value.episode,
          confidence: winner.confidence,
        })),
        usage: decision.usage,
      });

      const selected = decision.winners[randomInt(decision.winners.length)];
      logger.info({
        msg: "Arona roast random pick",
        quoteId: selected.value.id,
        text: selected.value.text,
        episode: selected.value.episode,
        confidence: selected.confidence,
      });
      await this.sendReply(event, selected.value.text);
    } catch (error) {
      logger.error({ msg: "Arona roast failed", error });
      await this.sendReply(event, "Arona 现在有点困……");
      throw error;
    }
  }
}
