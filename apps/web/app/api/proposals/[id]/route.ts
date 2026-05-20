import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import Proposal from '@/models/Proposal';
import { SignalModel } from '@/models/Signal';
import { resolveTokenDisplay } from '@/lib/constants/tokens';

export const dynamic = 'force-dynamic';

type LegacyFinancialImpact = {
  currentValue?: number;
  projectedValue?: number;
  riskLevel?: string;
  roi?: number;
  percentChange?: number;
};

type ProposalDetailRecord = {
  _id: mongoose.Types.ObjectId;
  action?: string;
  confidence?: number;
  createdAt?: Date;
  executionStatus?: 'PENDING' | 'EXECUTED' | 'IGNORED';
  expiresAt?: Date;
  financialImpact?: LegacyFinancialImpact;
  reason?: string[];
  sentimentType?: string;
  signalId?: mongoose.Types.ObjectId | string;
  status?: string;
  summary?: string;
  suggestionType?: string;
  title?: string;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  triggerEventId?: string;
  triggerSignalId?: mongoose.Types.ObjectId;
  type?: string;
  sources?: Array<{ label: string; url: string }>;
};

type SignalFallbackRecord = {
  _id: mongoose.Types.ObjectId;
  confidence?: number;
  detectedAt?: Date;
  expiresAt?: Date;
  rationaleSummary?: string;
  sentimentType?: string;
  sources?: Array<{ label?: string; url?: string }>;
  suggestionType?: string;
  tokenAddress?: string;
};

const ProposalModel = Proposal as unknown as mongoose.Model<ProposalDetailRecord>;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    let p = await ProposalModel.findById(id).lean<ProposalDetailRecord | null>();
    
    if (!p) {
      p = await ProposalModel.findOne({ 
        $or: [
          { triggerEventId: id },
          { triggerSignalId: new mongoose.Types.ObjectId(id) },
          { signalId: id }
        ] 
      }).lean<ProposalDetailRecord | null>();
    }
    
    if (!p) {
      const signal = await SignalModel.findById(id).lean<SignalFallbackRecord | null>();
      if (signal) {
        const token = resolveTokenDisplay(signal.tokenAddress);
        const suggestionType = signal.suggestionType?.toLowerCase();
        const action =
          suggestionType === 'buy' || suggestionType === 'stake'
            ? 'BUY'
            : suggestionType === 'sell' || suggestionType === 'close_position'
              ? 'SELL'
              : 'HOLD';

        return NextResponse.json({
          _id: signal._id.toString(),
          signalId: signal._id.toString(),
          tokenSymbol: token.symbol,
          tokenName: token.name,
          action,
          financialImpact: {
            currentValue: 0,
            projectedValue: 0,
            riskLevel: 'MEDIUM',
            roi: 0,
            percentChange: 0,
          },
          summary: signal.rationaleSummary,
          reason: signal.rationaleSummary ? [signal.rationaleSummary] : [],
          sources: signal.sources || [],
          confidence: signal.confidence ? (signal.confidence <= 1 ? Math.round(signal.confidence * 100) : signal.confidence) : 85,
          expiresAt: signal.expiresAt,
          createdAt: signal.detectedAt,
          status: 'signal-only',
          sentimentType: signal.sentimentType || 'neutral',
        });
      }

      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    let finalAction = 'HOLD';
    if (p.type) finalAction = p.type.toUpperCase();
    else if (p.action) finalAction = p.action.toUpperCase();
    else if (p.suggestionType) finalAction = p.suggestionType.toUpperCase();
    else {
      const title = p.title?.toLowerCase() || '';
      if (title.includes('sell') || title.includes('close')) finalAction = 'SELL';
      else if (title.includes('buy') || title.includes('long')) finalAction = 'BUY';
    }

    // === FIX ROI ===
    const roi = p.financialImpact?.roi !== undefined 
        ? p.financialImpact.roi 
        : (p.financialImpact?.percentChange || 0);

    const safeProposal = {
      _id: p._id.toString(),
      signalId: p.triggerEventId || p.triggerSignalId || p.signalId,
      tokenSymbol: p.tokenSymbol || (p.title ? p.title.split(' ')[0] : 'TOKEN'),
      tokenName: p.tokenName || p.title,
      action: finalAction,
      financialImpact: {
        currentValue: p.financialImpact?.currentValue || 0,
        projectedValue: p.financialImpact?.projectedValue || 0,
        riskLevel: (p.financialImpact?.riskLevel || 'MEDIUM').toUpperCase(),
        roi: roi, // ROI chuẩn
        percentChange: roi,
      },
      summary: p.summary,
      reason: p.reason || [],
      sources: p.sources || [],
      confidence: p.confidence ? (p.confidence <= 1 ? Math.round(p.confidence * 100) : p.confidence) : 85,
      expiresAt: p.expiresAt,
      createdAt: p.createdAt,
      status: p.status || p.executionStatus?.toLowerCase() || 'pending', // === FIX STATUS ===
      sentimentType: roi >= 0 ? 'positive' : 'negative'
    };

    return NextResponse.json(safeProposal);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Proposal detail API Error:', message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
