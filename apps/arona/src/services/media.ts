import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { Context, Effect, Layer } from "effect";

export interface MediaServiceShape {
  /**
   * Save a buffer as a media file.
   * @returns Full URL to access the saved media
   */
  readonly saveMedia: (buffer: Buffer, ext: string) => Effect.Effect<string, Error>;

  /**
   * Get URL for a permanent asset (e.g., "Arona_1.png").
   * Assets are served from the assets directory.
   */
  readonly getAssetUrl: (name: string) => string;

  /**
   * Get the target path for saving media directly (e.g., for yt-dlp).
   * @returns Object with path (full file path) and url (full URL to access)
   */
  readonly getMediaTarget: (filename: string) => { path: string; url: string };
}

export class MediaService extends Context.Tag("MediaService")<MediaService, MediaServiceShape>() {
  static makeLive = (config: { assetsDir: string; baseUrl: string }) =>
    Layer.succeed(
      MediaService,
      MediaService.of({
        saveMedia: (buffer, ext) =>
          Effect.gen(function* () {
            const id = randomUUID();
            const filename = `${id}.${ext}`;
            const filepath = join(config.assetsDir, filename);
            yield* Effect.promise(() => writeFile(filepath, buffer));
            return `${config.baseUrl}/media/${filename}`;
          }),

        getAssetUrl: (name) => `${config.baseUrl}/assets/${name}`,

        getMediaTarget: (filename) => ({
          path: join(config.assetsDir, filename),
          url: `${config.baseUrl}/media/${filename}`,
        }),
      })
    );
}
