import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";

export async function GET(
  req: Request, 
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const id = params.id;

    // Kiểm tra xem ID có đúng định dạng MongoDB ObjectId không
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const objId = new mongoose.Types.ObjectId(id);
    const collection = mongoose.connection.db.collection("proposals");
    
    const proposal = await collection.findOne({ _id: objId });

    if (!proposal) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // Trả về dữ liệu với _id dạng string
    return NextResponse.json({ 
      ...proposal, 
      _id: proposal._id.toString() 
    });

  } catch (err: any) {
    console.error("Detail Fetch Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}