import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
// Import Model từ Core Shared
import { ProposalModel } from '../../../../../core/proposal-generator/src/db/schema/proposals';

export async function GET() {
  try {
    await connectDB();
    
    const query: any = { 
      status: { $in: ['pending', 'active', 'open', 'trade', 'opportunity'] } 
    };

    // 1. Query dữ liệu từ MongoDB
    const proposals = await ProposalModel.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // 2. MAPPING DỮ LIỆU (Core Schema -> Frontend UI)
    const safeProposals = proposals.map((p: any) => {
      // Logic: Tách Symbol
      const title = p.title || '';
      const symbolMatch = title.match(/\b[A-Z]{2,6}\b/); 
      const extractedSymbol = symbolMatch ? symbolMatch[0] : 'TOKEN';
      
      // Logic: Map Action
      let action = 'HOLD';
      const typeLower = p.type?.toLowerCase() || '';
      const titleLower = p.title?.toLowerCase() || '';
      
      if (titleLower.includes('short') || titleLower.includes('sell')) {
        action = 'SELL';
      } else if (titleLower.includes('buy') || titleLower.includes('entry') || titleLower.includes('long')) {
        action = 'BUY';
      } else if (typeLower === 'trade' || typeLower === 'opportunity') {
        action = 'BUY';
      }

      // Logic: Confidence
      const percentChange = p.financialImpact?.percentChange || 0;
      const calculatedConfidence = percentChange ? Math.min(Math.abs(percentChange) * 5 + 50, 98) : 85;

      return {
        _id: p._id.toString(),
        
        tokenSymbol: extractedSymbol, 
        tokenName: p.title,
        action: action,
        
        financialImpact: {
          currentValue: p.financialImpact?.currentValue || 0,
          projectedValue: p.financialImpact?.projectedValue || 0,
          riskLevel: p.financialImpact?.riskLevel || 'MEDIUM',
          percentChange: percentChange,
        },

        title: p.title,
        summary: p.summary,
        reason: p.reason || [],
        
        confidence: Math.round(calculatedConfidence),
        socialScore: 85,
        sentimentType: percentChange >= 0 ? 'positive' : 'negative',
        sentimentScore: percentChange >= 0 ? 70 : -70,

        // Map sources
        sources: p.sources?.map((s: any) => s.url).filter(Boolean) || [],

        expiresAt: p.expiresAt || new Date(Date.now() + 86400000), 
        createdAt: p.createdAt,
      };
    });

    return NextResponse.json(safeProposals);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json([], { status: 200 }); 
  }
}