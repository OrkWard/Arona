import type { Message } from "./message.js";

export interface OneBotActionRequest<T extends Record<string, unknown> = {}> {
  action: string; // 动作名称
  param: T; // 动作参数
  echo?: string; // 用于唯一标志一个动作请求
}

export type OneBotActions = {
  get_online_clients: [
    {
      /** @default false */
      no_cache?: boolean;
    },
    { clients: object }
  ];
  get_status: [{}, { good: boolean; online: boolean }];
  get_version: [{}, { impl: string; version: string; onebot_version: string }];
  send_private_msg: [
    {
      user_id: number;
      message: Message;
      /** @default false 消息是否作为纯文本发送，不解析 CQ 码 */
      auto_escape: boolean;
    }
  ];
  send_group_msg: [
    {
      group_id: number;
      message: Message;
      auto_escape: boolean;
    },
    { message_id: number }
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
    }
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
