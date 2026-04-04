import { Context, Effect, Layer, Scope } from "effect";
import { MongoClient, Db, Collection } from "mongodb";

export interface MessageDoc {
  messageId: number;
  segmentIndex: number;
  groupId: number;
  senderId: number;
  sender: string;
  type: "text" | "image";
  content?: string;
  imageUrl?: string;
  perceptualHash?: string;
  pdqHashOriginal?: string;
  pdqHashQuality?: number;
  createdAt: Date;
}

export interface SimilarImageResult {
  sender: string;
  group: number;
  ctime: Date;
  imageUrl: string;
  perceptualHash: string;
  pdqHashOriginal: string;
  matchType: "phash" | "pdq";
  phashDistance?: number;
  pdqDistance?: number;
}

export interface DbServiceShape {
  readonly saveMessage: (data: Omit<MessageDoc, "_id" | "createdAt">) => Effect.Effect<void, Error>;
  readonly findSimilarImages: (
    params: { perceptualHash: string; pdqHashes: string[]; currentMsgId?: number },
    config: { phashThreshold: number; pdqThreshold: number }
  ) => Effect.Effect<SimilarImageResult[], Error>;
}

const COLLECTION_NAME = "messages";

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    // Handle hex strings of different lengths by padding
    const maxLen = Math.max(a.length, b.length);
    a = a.padStart(maxLen, "0");
    b = b.padStart(maxLen, "0");
  }
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    distance += (xor & 1) + ((xor >> 1) & 1) + ((xor >> 2) & 1) + ((xor >> 3) & 1);
  }
  return distance;
}

export class DbService extends Context.Tag("DbService")<DbService, DbServiceShape>() {
  static makeLive = (mongoUrl: string) =>
    Layer.scoped(
      DbService,
      Effect.gen(function* () {
        const client = new MongoClient(mongoUrl, { maxConnecting: 20 });
        yield* Effect.tryPromise({
          try: () => client.connect(),
          catch: (e) => new Error("Failed to connect to MongoDB", { cause: e }),
        });

        yield* Scope.addFinalizer(
          yield* Effect.scope,
          Effect.tryPromise({
            try: () => client.close(),
            catch: (e) => new Error("Failed to close MongoDB connection", { cause: e }),
          }).pipe(
            Effect.catchAll((e) =>
              Effect.sync(() => {
                console.error("Error closing MongoDB connection:", e);
              })
            )
          )
        );

        const db: Db = client.db("arona");
        const collection: Collection<MessageDoc> = db.collection(COLLECTION_NAME);

        // 建索引
        yield* Effect.tryPromise({
          try: async () => {
            await collection.createIndex({ messageId: 1, segmentIndex: 1 }, { unique: true });
            await collection.createIndex({ perceptualHash: 1 });
            await collection.createIndex({ pdqHashOriginal: 1 });
            await collection.createIndex({ createdAt: 1 });
            await collection.createIndex({ type: 1, createdAt: -1 });
          },
          catch: (e) => new Error("Failed to create indexes", { cause: e }),
        });

        return DbService.of({
          saveMessage: (data) =>
            Effect.tryPromise({
              try: () =>
                collection.insertOne({
                  ...data,
                  createdAt: new Date(),
                }),
              catch: (e) => new Error("Failed to save message", { cause: e }),
            }).pipe(Effect.map(() => undefined)),

          findSimilarImages: ({ perceptualHash, pdqHashes, currentMsgId }, { phashThreshold, pdqThreshold }) =>
            Effect.gen(function* () {
              const query: Record<string, unknown> = { type: "image", perceptualHash: { $exists: true } };
              if (currentMsgId) {
                query.messageId = { $ne: currentMsgId };
              }

              const images = yield* Effect.tryPromise({
                try: () => collection.find(query).toArray(),
                catch: (e) => new Error("Failed to query images", { cause: e }),
              });

              const results: SimilarImageResult[] = [];

              for (const img of images) {
                if (!img.perceptualHash || !img.pdqHashOriginal) continue;

                const phashDist = hammingDistance(perceptualHash, img.perceptualHash);
                const phashMatch = phashDist <= phashThreshold;

                let pdqMatch = false;
                let minPdqDist = Infinity;
                for (const pdqHash of pdqHashes) {
                  const dist = hammingDistance(pdqHash, img.pdqHashOriginal);
                  minPdqDist = Math.min(minPdqDist, dist);
                  if (dist <= pdqThreshold) {
                    pdqMatch = true;
                    break;
                  }
                }

                if (phashMatch || pdqMatch) {
                  results.push({
                    sender: img.sender,
                    group: img.groupId,
                    ctime: img.createdAt,
                    imageUrl: img.imageUrl!,
                    perceptualHash: img.perceptualHash,
                    pdqHashOriginal: img.pdqHashOriginal,
                    matchType: phashMatch ? "phash" : "pdq",
                    phashDistance: phashDist,
                    pdqDistance: minPdqDist === Infinity ? undefined : minPdqDist,
                  });
                }
              }

              return results;
            }),
        });
      })
    );
}
