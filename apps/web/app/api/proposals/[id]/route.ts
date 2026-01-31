import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { ProposalModel as RawProposalModel } from '../../../../../../core/proposal-generator/src/db/schema/proposals';

const ProposalModel = RawProposalModel as mongoose.Model<any>;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    let p = await ProposalModel.findById(id).lean();
    
    if (!p) {
      p = await ProposalModel.findOne({ 
        $or: [
          { triggerEventId: id },
          { triggerSignalId: new mongoose.Types.ObjectId(id) },
          { signalId: id }
        ] 
      }).lean();
    }
    
    if (!p) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    let finalAction = 'HOLD';
    if (p.type) finalAction = p.type.toUpperCase();
    else if (p.action) finalAction = p.action.toUpperCase();
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
      status: p.status || 'pending', // === FIX STATUS ===
      sentimentType: roi >= 0 ? 'positive' : 'negative'
    };

    return NextResponse.json(safeProposal);
  } catch (error: any) {
    console.error('💥 API Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}