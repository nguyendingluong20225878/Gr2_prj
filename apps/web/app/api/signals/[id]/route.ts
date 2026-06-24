import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose, { Model } from 'mongoose';

type SignalDetailRecord = {
  tokenSymbol?: string;
  symbol?: string;
  direction?: string;
  confidence?: number;
  sentimentType?: string;
  rationaleSummary?: string;
  sources?: Array<{ label?: string; url?: string }>;
  createdAt?: Date;
  detectedAt?: Date;
  expiresAt?: Date;
  metadata?: {
    processedAt?: Date;
    uncertaintyEntropy?: number;
    realizedVolatility?: number;
    volatilityFlag?: number;
  };
  uncertaintyEntropy?: number;
  realizedVolatility?: number;
  updatedAt?: Date;
};

// --- ĐỊNH NGHĨA MODEL SIGNAL ---
const SignalSchema = new mongoose.Schema({
  tokenSymbol: { type: String },
  symbol: { type: String },
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

const SIGNAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function resolveDetectedAt(signal: SignalDetailRecord) {
  return signal.detectedAt ?? signal.createdAt ?? signal.metadata?.processedAt ?? signal.updatedAt ?? new Date();
}

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

    const detectedAt = resolveDetectedAt(signal);

    return NextResponse.json({
      ...signal,
      detectedAt,
      expiresAt: signal.expiresAt ?? new Date(detectedAt.getTime() + SIGNAL_TTL_MS),
      uncertaintyEntropy: signal.uncertaintyEntropy ?? signal.metadata?.uncertaintyEntropy ?? signal.metadata?.volatilityFlag ?? null,
      realizedVolatility: signal.realizedVolatility ?? signal.metadata?.realizedVolatility ?? null,
    });
  } catch (error) {
    console.error('Fetch Signal API Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
