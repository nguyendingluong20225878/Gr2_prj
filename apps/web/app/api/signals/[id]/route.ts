import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose, { Model } from 'mongoose';

type SignalDetailRecord = {
  symbol?: string;
  direction?: string;
  confidence?: number;
  sentimentType?: string;
  rationaleSummary?: string;
  sources?: Array<{ label?: string; url?: string }>;
  detectedAt?: Date;
  expiresAt?: Date;
};

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

const SignalModel = (mongoose.models.Signal ||
  mongoose.model<SignalDetailRecord>('Signal', SignalSchema)) as Model<SignalDetailRecord>;

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
  } catch (error) {
    console.error('Fetch Signal API Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal Error', details: message }, { status: 500 });
  }
}
