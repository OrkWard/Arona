export type Self = {
  platform: string;
  user_id: string;
};

type MessageType = {
  text: {
    text: string;
  };
  mention: {
    user_id: string;
  };
  mention_all: {};
  image: {
    file_id: string;
  };
  voice: {
    file_id: string;
  };
  audio: {
    file_id: string;
  };
  video: {
    file_id: string;
  };
  file: {
    file_id: string;
  };
  reply: {
    message_id: string;
    user_id: string;
  };
};

type Convert<T> = {
  [K in keyof T]: { type: K; data: T[K] };
}[keyof T];

export type MessageSegment = Convert<MessageType>;

export type Message = MessageSegment[] | MessageSegment | string;
