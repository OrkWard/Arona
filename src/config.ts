interface OneBotConfig {
  origin: string;
  authKey: string;
  logger?: {
    silent?: boolean;
    debug?: boolean;
  };
  // Event response timeout, in millisecond
  // timeout: number = 10_000;
}

export const config: OneBotConfig = {
  authKey: process.env.AUTH_TOKEN!,
  origin: "sur4:3001",
  logger: {
    debug: true,
  },
};
