import { randomUUID } from "node:crypto";
import { GetObjectCommand, S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { AppConfig } from "./config.js";
import { logger } from "../util/logger.js";

const MEDIA_BUCKET = "media";
const STICKER_BUCKET = "sticker";

export class S3Service {
  static inject = ["config"] as const;

  private s3: S3Client;
  constructor(private config: AppConfig) {
    this.s3 = new S3Client({
      region: "auto",
      endpoint: this.config.s3Endpoint,
      credentials: {
        accessKeyId: this.config.s3Ak,
        secretAccessKey: this.config.s3Sk,
      },
      forcePathStyle: true,
    });
    logger.info("s3 client init");
  }

  /**
   * Save a buffer as a media file.
   * @returns Full URL to access the saved media
   */
  async saveMedia(buffer: Buffer, ext: string) {
    const id = randomUUID();
    const filename = `${id}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: MEDIA_BUCKET,
        Key: filename,
        Body: buffer,
      })
    );

    return `${this.config.s3Endpoint}/${MEDIA_BUCKET}/${filename}`;
  }

  async getJson<T>(bucket: string, key: string): Promise<T> {
    const response = await this.s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body) throw new Error(`S3 object has no body: ${bucket}/${key}`);
    return JSON.parse(await response.Body.transformToString()) as T;
  }

  /**
   * Get URL for a sticker (e.g., "Arona_1.png").
   */
  getStickerUrl(name: string) {
    return `${this.config.s3Endpoint}/${STICKER_BUCKET}/${name}`;
  }
}
