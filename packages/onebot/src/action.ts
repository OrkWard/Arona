import type { Message, MessageSegment, SendMessage } from "./message.js";

export interface OneBotActionRequest<T extends Record<string, unknown> = {}> {
  action: string; // 动作名称
  params: T; // 动作参数
  echo?: string; // 用于唯一标志一个动作请求
}

export type OneBotActions = {
  get_online_clients: [
    {
      /** @default false */
      no_cache?: boolean;
    },
    { clients: object },
  ];
  get_status: [{}, { good: boolean; online: boolean }];
  get_version: [{}, { impl: string; version: string; onebot_version: string }];
  send_private_msg: [
    {
      user_id: number;
      group_id?: number;
      message: SendMessage;
      /** @default false 消息是否作为纯文本发送，不解析 CQ 码 */
      auto_escape?: boolean;
    },
    {
      message_id: number;
    },
  ];
  send_group_msg: [
    {
      group_id: number;
      message: SendMessage;
      auto_escape?: boolean;
    },
    { message_id: number },
  ];
  delete_message: [{ message_id: string }, null];
  get_group_member_info: [
    { user_id: number; group_id: number; no_cache?: boolean },
    {
      user_id: number;
      nickname: number;
      card: string;
      join_time: number;
      last_send_time: number;
      level: string;
      role: "owner" | "admin" | "member";
      sex: string;
      age: number;
    },
  ];
  get_group_member_list: [
    { group_id: number },
    [
      {
        user_id: number;
        nickname: number;
        card: string;
        join_time: number;
        last_send_time: number;
        level: string;
        role: "owner" | "admin" | "member";
        sex: string;
        age: number;
      },
    ],
  ];
  ArkShareGroup: [{ group_id: number }, string];
  get_image: [{ file_id: string }, { file: string; url: string; file_size: string; file_name: string; base64: string }];
  get_msg: [
    { message_id: number },
    {
      group: boolean;
      group_id: number;
      message_id: number;
      real_id: number;
      message_type: "private" | "group";
      time: number;
      sender: {
        nickname: string;
        user_id: number;
      };
      message: Message;
      raw_message: string;
    },
  ];
  get_essence_msg_list: [
    { group_id: number },
    {
      sender_id: number;
      sender_nick: string;
      sender_time: number;
      operator_id: number;
      operator_nick: string;
      operator_time: number;
      message_id: number;
    }[],
  ];
};

/**
 * @param retcode
 *  - 0: OK
 *  - 1400: 消息格式错误
 *  - 1404: 不支持的 Action
 */
export type OneBotActionResponse = {
  [A in keyof OneBotActions]: {
    status: "ok" | "failed"; // 动作结果
    retcode: number; // 返回码
    data: OneBotActions[A][1]; // 数据
    message: string; // 错误信息, 成功时为空
    echo?: string; // 若动作请求中带了 echo, 应在此处返回
  };
}[keyof OneBotActions];
