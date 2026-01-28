import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

// --- ĐỊNH NGHĨA MODEL SIGNAL ---
const SignalSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  direction: { type: String }, 
  confidence: { type: Number },
  sentimentType: { type: String },
  rationaleSummary: { type: String },
  sources: { type: [mongoose.Schema.Types.Mixed] }, 
  detectedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
}, { 
  collection: 'signals',
  timestamps: true,
  strict: false 
});

// FIX LỖI "Expression is not callable":
// Ép kiểu (mongoose.models.Signal || ...) về mongoose.Model<any> để TypeScript hiểu đây là một Model chuẩn.
const SignalModel = (mongoose.models.Signal || mongoose.model('Signal', SignalSchema)) as mongoose.Model<any>;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const id = params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(null, { status: 404 });
    }

    // Lúc này .findById() sẽ hoạt động bình thường nhờ dòng ép kiểu ở trên
    const signal = await SignalModel.findById(id).lean();

    if (!signal) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }

    return NextResponse.json(signal);
  } catch (error: any) {
    console.error('Fetch Signal API Error:', error);
    return NextResponse.json({ error: 'Internal Error', details: error.message }, { status: 500 });
  }
}