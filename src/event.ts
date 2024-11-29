import type { Self } from "./base.js";

export type OneBotEvents = {
  meta: {
    connect: {};
    heartbeat: { interval: number };
    status_update: {};
  };
};

export type OneBotEvent = {
  [T in keyof OneBotEvents]: {
    [S in keyof OneBotEvents[T]]: {
      id: string; // 唯一标志符
      time: number; // 事件发生事件(Unix 时间戳), 单位: 秒
      type: T; // 事件基础类型（一级）
      detail_type: S; // 事件详细类型（二级）
      sub_type: string; // 详细类型的子类型(三级)
    };
  }[keyof OneBotEvents[T]];
}[keyof OneBotEvents];
