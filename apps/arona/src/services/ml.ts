import { processImageGetImageHashPost } from "../codegen/ml/index.js";
import { createClient } from "../codegen/ml/client/client.gen.js";
import { Client } from "../codegen/ml/client/types.gen.js";
import { AppConfig } from "./config.js";

export class MlService {
  static inject = ["config"] as const;

  private client: Client;

  constructor(private config: AppConfig) {
    this.client = createClient({ baseUrl: config.mlOrigin, throwOnError: true });
  }

  async getImageHash(url: string) {
    const res = await processImageGetImageHashPost({ client: this.client, body: { url } });
    return res.data;
  }
}
