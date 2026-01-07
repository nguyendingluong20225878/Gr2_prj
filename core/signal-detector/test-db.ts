// test-db.ts
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load biến môi trường từ .env
dotenv.config();

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI chưa được đặt trong .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("✅ Kết nối MongoDB thành công!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Kết nối MongoDB thất bại:", err);
    process.exit(1);
  }
}

testConnection();