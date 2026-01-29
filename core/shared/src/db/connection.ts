import mongoose, { Connection } from "mongoose";

// Hàm lấy URI từ biến môi trường
const getUri = () => process.env.MONGODB_URI ?? process.env.DATABASE_URL;

type GlobalWithMongoose = typeof globalThis & {
  __mongooseConnection?: {
    conn: Connection | null;
    promise: Promise<Connection> | null;
  };
};

const globalWithMongoose = globalThis as GlobalWithMongoose;

if (!globalWithMongoose.__mongooseConnection) {
  globalWithMongoose.__mongooseConnection = { conn: null, promise: null };
}

/**
 * Kết nối tới MongoDB một cách an toàn
 */
export async function connectToDatabase(): Promise<Connection> {
  const uri = getUri();
  
  if (!uri) {
    throw new Error("connection.ts: MONGODB_URI (hoặc DATABASE_URL) chưa được thiết lập trong biến môi trường.");
  }

  if (globalWithMongoose.__mongooseConnection?.conn) {
    return globalWithMongoose.__mongooseConnection.conn;
  }

  if (!globalWithMongoose.__mongooseConnection?.promise) {
    mongoose.set("strictQuery", true);

    globalWithMongoose.__mongooseConnection!.promise = mongoose
      .connect(uri, { 
        autoIndex: true,
        serverSelectionTimeoutMS: 10000,
      })
      .then((mongooseInstance) => mongooseInstance.connection);
  }

  globalWithMongoose.__mongooseConnection!.conn = await globalWithMongoose.__mongooseConnection!.promise!;
  return globalWithMongoose.__mongooseConnection!.conn!;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (globalWithMongoose.__mongooseConnection?.conn) {
    await mongoose.disconnect();
    globalWithMongoose.__mongooseConnection.conn = null;
    globalWithMongoose.__mongooseConnection.promise = null;
  }
}

export { mongoose };