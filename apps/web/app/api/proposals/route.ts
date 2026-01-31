import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { ProposalModel as RawProposalModel } from '../../../../../core/proposal-generator/src/db/schema/proposals';

const ProposalModel = RawProposalModel as mongoose.Model<any>;

export async function GET() {
  try {
    await connectDB();
    
    // Lấy tất cả các trạng thái hợp lệ
    const query: any = { 
      status: { $in: ['pending', 'active', 'open', 'trade', 'opportunity', 'ACTIVE', 'EXECUTED'] } 
    };

    const proposals = await ProposalModel.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const safeProposals = proposals.map((p: any) => {
      const title = p.title || '';
      const symbolMatch = title.match(/\b[A-Z]{2,6}\b/); 
      const extractedSymbol = p.tokenSymbol || (symbolMatch ? symbolMatch[0] : 'TOKEN');
      
      let action = p.action || 'BUY';
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
        status: p.status || 'pending', // === FIX STATUS: Trả về status thực ===
      };
    });

    return NextResponse.json(safeProposals);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json([], { status: 200 }); 
  }
}