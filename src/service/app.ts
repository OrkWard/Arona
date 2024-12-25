import { Service } from "typedi";
import { mergeDeep } from "../utils/index.js";

type OneBotConfig = {
  origin: string;
  authKey: string;
  logger?: {
    silent?: boolean;
    debug?: boolean;
  };
  // Event response timeout, in millisecond
  // timeout: number = 10_000;
};

@Service()
export class AppConfig {
  private _config: OneBotConfig = {
    authKey: process.env.AUTH_TOKEN!,
    origin: "sur4:3001",
  };
  constructor() {}

  set config(c: Partial<OneBotConfig>) {
    this._config = mergeDeep<OneBotConfig>(this._config, c);
  }

  get config(): OneBotConfig {
    return this._config;
  }
}
