import { MongoClient, Collection } from "mongodb";
import { AppConfig } from "./config.js";
import { logger } from "../util/logger.js";

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

const DB_NAME = "arona";
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

export class DbService {
  static inject = ["config"] as const;

  private _client?: MongoClient;
  constructor(private config: AppConfig) {}

  get client(): Promise<MongoClient> {
    if (this._client) return Promise.resolve(this._client);

    const c = new MongoClient(this.config.mongoUrl, { maxConnecting: 20 });
    logger.info("Mongo client init");
    this._client = c;
    return c.connect();
  }
  get collection(): Promise<Collection<MessageDoc>> {
    return this.client.then((c) => c.db(DB_NAME).collection(COLLECTION_NAME));
  }

  async createIndex() {
    const collection = await this.collection;
    await collection.createIndex({ messageId: 1, segmentIndex: 1 }, { unique: true });
    await collection.createIndex({ perceptualHash: 1 });
    await collection.createIndex({ pdqHashOriginal: 1 });
    await collection.createIndex({ createdAt: 1 });
    await collection.createIndex({ type: 1, createdAt: -1 });
  }

  // save a message to db
  async saveMessage(data: Omit<MessageDoc, "_id" | "createdAt">) {
    const collection = await this.collection;
    await collection.insertOne({
      ...data,
      createdAt: new Date(),
    });
  }

  async findSimilarImages(
    params: { perceptualHash: string; pdqHashes: string[]; currentMsgId: number },
    config: { phashThreshold: number; pdqThreshold: number }
  ) {
    const { pdqHashes, perceptualHash, currentMsgId } = params;
    const { pdqThreshold, phashThreshold } = config;
    const collection = await this.collection;

    // query all images except current one
    const query: Record<string, unknown> = {
      type: "image",
      perceptualHash: { $exists: true },
      messageId: {
        $ne: currentMsgId,
      },
    };
    const images = await collection.find(query).toArray();

    const results: SimilarImageResult[] = [];
    for (const img of images) {
      if (!img.perceptualHash || !img.pdqHashOriginal) continue;

      // compare phash
      const phashDist = hammingDistance(perceptualHash, img.perceptualHash);
      const phashMatch = phashDist <= phashThreshold;

      // compare pdq hash. since pdq hash can't handle rotate & flip we should compare for 8 times
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
  }
}
