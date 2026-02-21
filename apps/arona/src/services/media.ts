import { randomUUID } from "node:crypto";
import { Context, Effect, Layer } from "effect";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export interface S3ServiceShape {
  /**
   * Save a buffer as a media file.
   * @returns Full URL to access the saved media
   */
  readonly saveMedia: (buffer: Buffer, ext: string) => Effect.Effect<string, Error>;

  /**
   * Get URL for a sticker (e.g., "Arona_1.png").
   */
  readonly getStickerUrl: (name: string) => string;
}

export class S3Service extends Context.Tag("MediaService")<S3Service, S3ServiceShape>() {
  static makeLive = (config: {
    endpoint: string;
    ak: string;
    sk: string;
    stickerBucket: string;
    mediaBucket: string;
  }) =>
    Layer.effect(
      S3Service,
      Effect.gen(function* () {
        const S3 = new S3Client({
          region: "auto",
          endpoint: config.endpoint,
          credentials: {
            accessKeyId: config.ak,
            secretAccessKey: config.sk,
          },
          forcePathStyle: true,
        });

        return S3Service.of({
          saveMedia: (buffer, ext) =>
            Effect.gen(function* () {
              const id = randomUUID();
              const filename = `${id}.${ext}`;

              yield* Effect.tryPromise({
                try: () =>
                  S3.send(
                    new PutObjectCommand({
                      Bucket: config.mediaBucket,
                      Key: filename,
                      Body: buffer,
                    })
                  ),
                catch: (e) => e as Error,
              });

              return `${config.endpoint}/${config.mediaBucket}/${filename}`;
            }),

          getStickerUrl: (name) => `${config.endpoint}/${config.stickerBucket}/${name}`,
        });
      })
    );
}
