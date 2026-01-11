import mongoose from "mongoose";
import { NextResponse } from "next/server";

const mongoUri = process.env.MONGODB_URI;

async function ensureConnected() {
  if (!mongoUri) throw new Error("MONGODB_URI not set");
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(mongoUri);
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await ensureConnected();
    const id = params.id;
    const objId = new mongoose.Types.ObjectId(id);
    const p = await mongoose.connection.db.collection("proposals").findOne({ _id: objId });
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ...p, _id: p._id.toString() });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
