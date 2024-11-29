import type { Message, Self } from "./base.js";

export interface OneBotActionRequest<T extends Record<string, unknown> = {}> {
  action: string; // 动作名称
  param: T; // 动作参数
  echo?: string; // 用于唯一标志一个动作请求
  self?: Self; // 多个机器人账号共用一个 OneBot Connection 时, 必传, 用于标志机器人账号
}

/**
 * @param retcode
 *  - 0: OK
 *  - 1xxxx: Request Error, 见 https://12.onebot.dev/connect/data-protocol/action-response/#1xxxx-request-error
 *  - 2xxxx: Handler Error, 见 https://12.onebot.dev/connect/data-protocol/action-response/#2xxxx-handler-error
 *  - 3xxxx: Execution Error, 见 https://12.onebot.dev/connect/data-protocol/action-response/#3xxxx-execution-error
 *  - 4xxxx, 5xxxx: 保留段, 不使用
 *  - 6xxxx ~ 9xxxxx: 其他错误段, 可自定义
 */
export interface OneBotActionResponse {
  status: "ok" | "failed"; // 动作结果
  retcode: number; // 返回码
  data: unknown; // 数据
  message: string; // 错误信息, 成功时为空
  echo?: string; // 若动作请求中带了 echo, 应在此处返回
}

export type OneBotActions = {
  get_supported_actions: [{}, string[]];
  get_status: [{}, { good: boolean; bots: { self: Self; online: boolean }[] }];
  get_version: [{}, { impl: string; version: string; onebot_version: string }];
  send_message: [
    (
      | { detail_type: "private"; user_id: string; message: Message }
      | { detail_type: "group"; group_id: string; message: Message }
    ),
    { message_id: string; time: number }
  ];
  delete_message: [{ message_id: string }, null];
};
