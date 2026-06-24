import dotenv from "dotenv";
import { connectToDatabase } from "../../shared/src/index.js";

dotenv.config();

const apply = process.argv.includes("--apply");
const reopenRecentFailures = process.argv.includes("--reopen-recent-failures");

async function main() {
  const connection = await connectToDatabase();
  const db = connection.db;
  if (!db) throw new Error("MongoDB connection is unavailable");

  const nativeTokens = await db.collection("tokens").find(
    { address: "native", canonicalKey: { $type: "string" } },
    { projection: { symbol: 1, canonicalKey: 1 } }
  ).toArray();
  const canonicalBySymbol = new Map(nativeTokens.map((token: any) => [String(token.symbol).toUpperCase(), String(token.canonicalKey)]));
  const nativeSignals = await db.collection("signals").find({ tokenAddress: "native" }, { projection: { _id: 1, tokenSymbol: 1 } }).toArray();
  const nativeProposals = await db.collection("proposals").find({ tokenAddress: "native" }, { projection: { _id: 1, tokenSymbol: 1 } }).toArray();
  const activeWithoutExpiry = await db.collection("proposals").countDocuments({
    lifecycleStatus: "ACTIVE",
    $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }],
  });

  const unmappedSignals = nativeSignals.filter((signal: any) => !canonicalBySymbol.has(String(signal.tokenSymbol ?? "").toUpperCase())).length;
  const unmappedProposals = nativeProposals.filter((proposal: any) => !canonicalBySymbol.has(String(proposal.tokenSymbol ?? "").toUpperCase())).length;
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    nativeTokenMappings: canonicalBySymbol.size,
    nativeSignals: nativeSignals.length,
    nativeProposals: nativeProposals.length,
    activeWithoutExpiry,
    unmappedSignals,
    unmappedProposals,
  }, null, 2));

  if (!apply) return;

  const migrate = async (collection: "signals" | "proposals", rows: any[]) => {
    const operations = rows.flatMap((row: any) => {
      const canonicalKey = canonicalBySymbol.get(String(row.tokenSymbol ?? "").toUpperCase());
      return canonicalKey ? [{ updateOne: { filter: { _id: row._id, tokenAddress: "native" }, update: { $set: { tokenAddress: canonicalKey, updatedAt: new Date() } } } }] : [];
    });
    return operations.length ? db.collection(collection).bulkWrite(operations, { ordered: false }) : null;
  };

  const [signalWrite, proposalWrite, expiryWrite] = await Promise.all([
    migrate("signals", nativeSignals),
    migrate("proposals", nativeProposals),
    db.collection("proposals").updateMany(
      { lifecycleStatus: "ACTIVE", $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }] },
      { $set: { lifecycleStatus: "EXPIRED", expiredAt: new Date(), updatedAt: new Date() } }
    ),
  ]);

  let reopened = 0;
  if (reopenRecentFailures) {
    const result = await db.collection("signals").updateMany(
      {
        status: "FAILED",
        detectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        lastLayer3Error: /duplicate key error.*tokenAddress_1/i,
      },
      { $set: { status: "RAW", layer3RetryCount: 0, layer3LockedAt: null, layer3LockedBy: null, nextLayer3RetryAt: null, lastLayer3Error: null, errorType: null, updatedAt: new Date() } }
    );
    reopened = result.modifiedCount;
  }

  console.log(JSON.stringify({
    signalAddressesUpdated: signalWrite?.modifiedCount ?? 0,
    proposalAddressesUpdated: proposalWrite?.modifiedCount ?? 0,
    legacyActiveExpired: expiryWrite.modifiedCount,
    recentFailuresReopened: reopened,
  }, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { const { disconnectFromDatabase } = await import("../../shared/src/index.js"); await disconnectFromDatabase(); });
