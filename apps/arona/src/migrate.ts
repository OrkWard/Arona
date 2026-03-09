import { MongoClient } from "mongodb";

/**
 * Migration: Update message schema
 * - Remove rawMessageId field
 * - Convert messageId from `${rawMessageId}-${segmentIndex}` format to just rawMessageId (number)
 *
 * Run with: node dist/migrate.js <mongo-url>
 * Or: MONGO_URL=mongodb://... node dist/migrate.js
 */

async function migrate(mongoUrl: string) {
  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("arona");
    const collection = db.collection("messages");

    // Step 1: Drop the unique index first to avoid conflicts during migration
    console.log("Dropping old unique index...");
    await collection.dropIndex("messageId_1").catch(() => {
      console.log("Index messageId_1 not found or already dropped");
    });

    // Find documents that still have rawMessageId (old schema)
    const oldDocs = await collection.find({ rawMessageId: { $exists: true } }).toArray();
    console.log(`Found ${oldDocs.length} documents to migrate`);

    if (oldDocs.length === 0) {
      console.log("No documents need migration");
    } else {
      let migrated = 0;
      let errors = 0;

      for (const doc of oldDocs) {
        try {
          const newMessageId = doc.rawMessageId;

          await collection.updateOne(
            { _id: doc._id },
            {
              $set: { messageId: newMessageId },
              $unset: { rawMessageId: "" },
            }
          );

          migrated++;
          if (migrated % 100 === 0) {
            console.log(`Migrated ${migrated}/${oldDocs.length} documents...`);
          }
        } catch (e) {
          console.error(`Failed to migrate document ${doc._id}:`, e);
          errors++;
        }
      }

      console.log(`Migration complete: ${migrated} migrated, ${errors} errors`);
    }

    // Step 2: Create compound unique index on (messageId, segmentIndex)
    console.log("Creating new compound index on (messageId, segmentIndex)...");
    await collection.createIndex({ messageId: 1, segmentIndex: 1 }, { unique: true });
    console.log("New index created successfully");
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
}

const mongoUrl = process.argv[2] || process.env.MONGO_URL;

if (!mongoUrl) {
  console.error("Usage: node dist/migrate.js <mongo-url>");
  console.error("Or set MONGO_URL environment variable");
  process.exit(1);
}

migrate(mongoUrl).catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
