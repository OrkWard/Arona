type MessageType = {
  text: {
    text: string;
  };
  face: {
    id: string;
  };
  at: {
    qq: string; // all 表示所有人
  };
  image: {
    file?: string;
    type?: string;
    url: string;
  };
  record: {
    file: string;
    magic: number;
    url: string;
  };
  video: {
    file: string;
    url: string;
  };
  file: {
    file: string;
  };
  reply: {
    id: string;
  };
  json: {
    data: string;
  };
};

export type MessageSegment = {
  [K in keyof MessageType]: { type: K; data: MessageType[K] };
}[keyof MessageType];

// export type Message = MessageSegment[] | MessageSegment | string;
export type Message = MessageSegment[];

type SendMessageType = {
  text: {
    text: string;
  };
  face: {
    id: string;
  };
  at: {
    qq: string;
  };
  image: {
    file: string;
  };
  record: {
    file: string;
  };
  video: {
    file: string;
  };
  file: {
    file: string;
  };
  reply: {
    id: string;
  };
  json: {
    data: string;
  };
};

export type SendMessageSegment = {
  [K in keyof SendMessageType]: { type: K; data: SendMessageType[K] };
}[keyof SendMessageType];

export type SendMessage = SendMessageSegment[];
