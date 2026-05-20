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
  status?: string;
  summary?: string;
  suggestionType?: string;
  title?: string;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
};

const ProposalModel = Proposal as unknown as mongoose.Model<ProposalListRecord>;

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
      const title = p.title || '';
      const symbolMatch = title.match(/\b[A-Z]{2,6}\b/); 
      const extractedSymbol = p.tokenSymbol || (symbolMatch ? symbolMatch[0] : 'TOKEN');
      
      let action = p.action || p.suggestionType?.toUpperCase() || 'BUY';
      const titleLower = title.toLowerCase();
      if (titleLower.includes('short') || titleLower.includes('sell')) {
        action = 'SELL';
      }

      // === FIX ROI: Ưu tiên lấy 'roi' từ DB, fallback sang 'percentChange' ===
      const roi = p.financialImpact?.roi !== undefined 
        ? p.financialImpact.roi 
        : (p.financialImpact?.percentChange || 0);

      // Chuẩn hóa confidence
      let confidence = p.confidence || 85;
      if (confidence <= 1) confidence = Math.round(confidence * 100);

      return {
        _id: p._id.toString(),
        tokenSymbol: extractedSymbol, 
        tokenName: p.tokenName || p.title,
        action: action,
        financialImpact: {
          currentValue: p.financialImpact?.currentValue || 0,
          projectedValue: p.financialImpact?.projectedValue || 0,
          riskLevel: (p.financialImpact?.riskLevel || 'MEDIUM').toUpperCase(),
          roi: roi, // Trả về trường roi chuẩn
          percentChange: roi, // Giữ tương thích ngược
        },
        title: p.title,
        summary: p.summary,
        reason: p.reason || [],
        confidence: confidence,
        sentimentType: roi >= 0 ? 'positive' : 'negative',
        expiresAt: p.expiresAt || new Date(Date.now() + 86400000), 
        createdAt: p.createdAt,
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
