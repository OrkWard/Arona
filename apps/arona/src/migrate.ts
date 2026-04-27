import { DbService } from "./services/db.js";

export async function migrate(db: DbService) {
  const collection = await db.collection;

  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.warn("warn: dry-run mode");
  }

  const cursor = collection.find({
    $or: [{ perceptualHash: { $type: "string" } }, { pdqHashOriginal: { $type: "string" } }],
  });

  let updatedCount = 0;

  for await (const doc of cursor) {
    const set: Record<string, Buffer> = {};

    if (typeof doc.perceptualHash === "string") {
      set.perceptualHash = Buffer.from(doc.perceptualHash, "hex");
    }
    if (typeof doc.pdqHashOriginal === "string") {
      set.pdqHashOriginal = Buffer.from(doc.pdqHashOriginal, "hex");
    }

    if (Object.keys(set).length > 0) {
      if (!dryRun) {
        await collection.updateOne({ _id: doc._id }, { $set: set });
      }
      updatedCount++;
    }
  }

  console.log(`${updatedCount} record updated`);
}
migrate.inject = ["db"] as const;
