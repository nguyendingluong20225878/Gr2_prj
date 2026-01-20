import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb"; //
import mongoose from "mongoose";

export async function GET() {
  try {
    await connectDB(); // Kết nối DB dùng hàm chuẩn đã tạo
    
    // Truy cập trực tiếp collection "proposals"
    const collection = mongoose.connection.db.collection("proposals");
    
    // Lấy 50 tin mới nhất, sắp xếp theo thời gian tạo (mới nhất lên đầu)
    // Giả sử field thời gian là 'createdAt', nếu DB bạn dùng tên khác hãy sửa lại
    const proposals = await collection
      .find({})
      .sort({ createdAt: -1 }) 
      .limit(50)
      .toArray();

    // Convert _id Object sang String để không lỗi JSON
    const safeProposals = proposals.map(p => ({
      ...p,
      _id: p._id.toString(),
    }));

    return NextResponse.json(safeProposals);
  } catch (err: any) {
    console.error("Database Error:", err);
    // Trả về mảng rỗng để frontend không bị crash
    return NextResponse.json([], { status: 200 }); 
  }
}