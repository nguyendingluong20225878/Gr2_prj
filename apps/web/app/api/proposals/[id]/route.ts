import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { ProposalModel } from '../../../../../../core/proposal-generator/src/db/schema/proposals';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const id = params.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // FIX LỖI TYPESCRIPT: Query object ép kiểu any
    const query: any = { _id: new mongoose.Types.ObjectId(id) };

    const p: any = await ProposalModel.findOne(query).lean();
    
    if (!p) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    
    // --- MAPPING LOGIC ---
    const extractedSymbol = p.title ? p.title.split(' ')[0].toUpperCase() : 'UNK';
    
    let action = 'HOLD';
    const typeLower = p.type?.toLowerCase() || '';
    const titleLower = p.title?.toLowerCase() || '';
    if (typeLower === 'trade' || typeLower === 'opportunity') {
       action = (titleLower.includes('short') || titleLower.includes('sell')) ? 'SELL' : 'BUY';
    }

    const percentChange = p.financialImpact?.percentChange || 0;
    const calculatedConfidence = percentChange ? Math.min(Math.abs(percentChange) * 5 + 50, 98) : 85;

    const safeProposal = {
      ...p,
      _id: p._id.toString(),
      tokenSymbol: extractedSymbol,
      tokenName: p.title,
      action: action,
      confidence: Math.round(calculatedConfidence),
      sentimentType: percentChange >= 0 ? 'positive' : 'negative',
      sentimentScore: percentChange >= 0 ? 70 : -70,
      
      financialImpact: {
        currentValue: p.financialImpact?.currentValue || 0,
        projectedValue: p.financialImpact?.projectedValue || 0,
        riskLevel: p.financialImpact?.riskLevel || 'MEDIUM',
        percentChange: percentChange,
      },

      sources: p.sources?.map((s: any) => s.url).filter(Boolean) || [],
    };

    return NextResponse.json(safeProposal);
  } catch (error) {
    console.error('Detail API Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}