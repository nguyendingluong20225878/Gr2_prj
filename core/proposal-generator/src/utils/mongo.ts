import mongoose from "mongoose";

let isConnected = false;

export async function connectMongo() {
  if (isConnected) return;

  const mongoUri = process.env.MONGODB_URI ?? process.env.DATABASE_URL;
  if (!mongoUri) {
    console.warn(
      "proposal-generator: MongoDB not configured; DB helpers will be no-op",
    );
    return;
  }

  await mongoose.connect(mongoUri);
  isConnected = true;
}
