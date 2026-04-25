import { processImageGetImageHashPost } from "../codegen/ml/index.js";
import { createClient } from "../codegen/ml/client/client.gen.js";
import { Client } from "../codegen/ml/client/types.gen.js";
import { AppConfig } from "./config.js";

export class MlService {
  static inject = ["config"] as const;

  private _client?: Client;

  constructor(private config: AppConfig) {}

  get client(): Client {
    if (this._client) {
      return this._client;
    }

    const c = createClient({ baseUrl: this.config.mlOrigin });
    this._client = c;
    return c;
  }

  async getImageHash(url: string) {
    const res = await processImageGetImageHashPost({ client: this.client, body: { url } });
    return res.data;
  }
}
