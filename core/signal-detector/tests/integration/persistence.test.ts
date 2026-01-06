import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { saveSignalToDb } from "../../src/persistence";
import type { LlmSignalResponse } from "../../src/types";

let mongod: MongoMemoryServer | null = null;
const useRealMongo = Boolean(process.env.USE_REAL_MONGO);

beforeAll(async () => {
  if (useRealMongo) {
    if (!process.env.MONGODB_URI) {
      throw new Error("USE_REAL_MONGO is set but MONGODB_URI is not provided");
    }
    console.warn("persistence.test: Using real MongoDB at " + process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI as string);
  } else {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    await mongoose.connect(process.env.MONGODB_URI as string);
  }
},60000);

afterAll(async () => {
  if (useRealMongo) {
    try {
      await mongoose.connection.db?.dropDatabase();
    } catch (err) {
      // ignore cleanup errors
    }
    await mongoose.disconnect();
  } else {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  }
}, 30000);

beforeEach(async () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database connection not established");
  // Ensure test isolation
  await db.collection("signals").deleteMany({});
}, 20000);

describe("Signal persistence (integration)", () => {
  it("should persist a detected signal to MongoDB", async () => {
    const resp: LlmSignalResponse = {
      signalDetected: true,
      tokenAddress: "0xINTEGRATION_TEST",
      sources: [{ url: "https://x.com/test/1", label: "tweet" }],
      sentimentScore: 0.4,
      suggestionType: "buy",
      strength: 50,
      confidence: 0.8,
      reasoning: "Integration test reasoning",
      relatedTweetIds: ["t1"],
      impactScore: 5,
    } as any;

    const created = await saveSignalToDb(resp);
    expect(created).toBeDefined();
    expect(created.tokenAddress).toBe(resp.tokenAddress);

    const db = mongoose.connection.db;
    if (!db) throw new Error("Database connection not established");
    const found = await db.collection("signals").findOne({ tokenAddress: resp.tokenAddress });
    
    expect(found).not.toBeNull();
    expect(found!.tokenAddress).toBe(resp.tokenAddress);
    expect(found!.rationaleSummary).toContain("Integration test reasoning");
  }, 60000);
});
