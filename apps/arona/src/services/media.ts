import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { AppConfig } from "./config.js";

const MEDIA_BUCKET = "media";
const STICKER_BUCKET = "sticker";

export class S3Service {
  static inject = ["config"] as const;

  private _s3client?: S3Client;
  constructor(private config: AppConfig) {}

  get S3(): S3Client {
    if (this._s3client) return this._s3client;

    const s = new S3Client({
      region: "auto",
      endpoint: this.config.s3Endpoint,
      credentials: {
        accessKeyId: this.config.s3Ak,
        secretAccessKey: this.config.s3Sk,
      },
      forcePathStyle: true,
    });
    this._s3client = s;
    return s;
  }

  /**
   * Save a buffer as a media file.
   * @returns Full URL to access the saved media
   */
  async saveMedia(buffer: Buffer, ext: string) {
    const id = randomUUID();
    const filename = `${id}.${ext}`;

    await this.S3.send(
      new PutObjectCommand({
        Bucket: MEDIA_BUCKET,
        Key: filename,
        Body: buffer,
      })
    );

    return `${this.config.s3Endpoint}/${MEDIA_BUCKET}/${filename}`;
  }

  /**
   * Get URL for a sticker (e.g., "Arona_1.png").
   */
  getStickerUrl(name: string) {
    return `${this.config.s3Endpoint}/${STICKER_BUCKET}/${name}`;
  }
}
