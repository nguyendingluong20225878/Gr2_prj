import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import Proposal from '@/models/Proposal';

export const dynamic = 'force-dynamic';

type LegacyFinancialImpact = {
  currentValue?: number;
  projectedValue?: number;
  riskLevel?: string;
  roi?: number;
  percentChange?: number;
};

type ProposalListRecord = {
  _id: mongoose.Types.ObjectId;
  action?: string;
  confidence?: number;
  createdAt?: Date;
  executionStatus?: 'PENDING' | 'EXECUTED' | 'IGNORED';
  expiresAt?: Date;
  financialImpact?: LegacyFinancialImpact;
  reason?: string[];
  sentimentType?: string;
  signalId?: mongoose.Types.ObjectId;
  pnlPercentage?: number;
  quantScore?: number;
  status?: string;
  summary?: string;
  suggestionType?: string;
  title?: string;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
};

const ProposalModel = Proposal as unknown as mongoose.Model<ProposalListRecord>;
const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeAction(value?: string): 'BUY' | 'SELL' | 'HOLD' | 'UNKNOWN' {
  const upper = String(value ?? '').toUpperCase();
  if (upper === 'BUY' || upper === 'SELL' || upper === 'HOLD') return upper;
  return 'UNKNOWN';
}

function deriveExpiresAt(createdAt?: Date) {
  return new Date((createdAt?.getTime() ?? Date.now()) + PROPOSAL_TTL_MS);
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    await connectDB();
    
    const query = {
      $or: [
        { status: { $in: ['pending', 'active', 'open', 'trade', 'opportunity', 'ACTIVE', 'EXECUTED'] } },
        { executionStatus: { $in: ['PENDING', 'EXECUTED'] } },
      ],
    };

    const proposals = await ProposalModel.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean<ProposalListRecord[]>();

    const safeProposals = proposals.map((p) => {
      const action = normalizeAction(p.action ?? p.suggestionType);
      const roi = nullableNumber(p.financialImpact?.roi);

      // Chuẩn hóa confidence
      const rawConfidence = typeof p.confidence === 'number' ? p.confidence : null;
      const confidence = rawConfidence === null
        ? null
        : rawConfidence <= 1
          ? Math.round(rawConfidence * 100)
          : rawConfidence;
      const sentimentType = p.sentimentType ?? 'unknown';

      return {
        _id: p._id.toString(),
        tokenSymbol: p.tokenSymbol || null,
        tokenName: p.tokenName || p.title || null,
        action: action,
        financialImpact: {
          currentValue: nullableNumber(p.financialImpact?.currentValue),
          projectedValue: nullableNumber(p.financialImpact?.projectedValue),
          riskLevel: p.financialImpact?.riskLevel?.toUpperCase() ?? null,
          roi,
          percentChange: nullableNumber(p.financialImpact?.percentChange),
        },
        roiStatus: roi === null ? 'NOT_AVAILABLE' : 'AVAILABLE',
        title: p.title,
        summary: p.summary,
        reason: p.reason || [],
        confidence: confidence,
        sentimentType,
        expiresAt: p.expiresAt ?? deriveExpiresAt(p.createdAt),
        createdAt: p.createdAt,
        quantScore: nullableNumber(p.quantScore),
        pnlPercentage: nullableNumber(p.pnlPercentage),
        status: p.status || p.executionStatus?.toLowerCase() || 'pending', // === FIX STATUS: Trả về status thực ===
      };
    });

    return NextResponse.json(safeProposals);
  } catch (error) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch proposals';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
