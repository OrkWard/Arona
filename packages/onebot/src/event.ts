import { Message } from "./message.js";

export type OneBotEventBase = {
  time: number; // 事件发生事件(Unix 时间戳), 单位: 秒
  self_id: number; // 机器人 QQ 号
};

export type OneBotMetaEvent = OneBotEventBase & {
  post_type: "meta_event";
} & (
    | {
        meta_event_type: "lifecycle";
        sub_type: "connect";
      }
    | { meta_event_type: "heartbeat"; status: { online: boolean; good: boolean } }
  );

export type OneBotMessageEvent = OneBotEventBase & {
  post_type: "message";
} & (
    | {
        message_type: "group";
        sub_type: "normal" | "anonymous" | "notice";
        message_id: number;
        group_id: number;
        user_id: number;
        time: number;
        message: Message;
        raw_message: string;
        sender: {
          user_id: number;
          nickname: string;
          role: string;
          card?: string;
        };
      }
    | {
        message_type: "private";
        sub_type: "friend" | "group" | "other";
        message_id: number;
        user_id: number;
        time: number;
        message: Message;
        raw_message: string;
        sender: {
          user_id: number;
          nickname: string;
        };
      }
  );

export type OneBotNoticeEvent = OneBotEventBase & {
  post_type: "notice";
} & (
    | {
        notice_type: "notify";
        sub_type: "poke";
        group_id: number;
        user_id: number;
        target_id: number;
      }
    | {
        notice_type: "group_increase";
        sub_type: "approve" | "invite";
        group_id: number;
        operator_id: number;
        user_id: number;
      }
  );

export type OneBotEvent = OneBotMetaEvent | OneBotMessageEvent | OneBotNoticeEvent;
