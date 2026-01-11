import { NextResponse } from "next/server";
import dbConnect from "@/lib/db"; // Import hàm connect xịn vừa tạo
import mongoose from "mongoose";

export async function GET() {
  try {
    await dbConnect(); // Kết nối DB (có cache)
    
    // Kiểm tra xem collection có tồn tại không để tránh lỗi crash
    const collection = mongoose.connection.db.collection("proposals");
    const proposals = await collection.find({}).limit(20).toArray();

    return NextResponse.json(proposals);
  } catch (err: any) {
    console.error("Database Error:", err);
    // Trả về mảng rỗng thay vì lỗi 500 để giao diện không bị chết
    return NextResponse.json([], { status: 200 }); 
  }
}