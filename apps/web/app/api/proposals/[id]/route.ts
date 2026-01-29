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

    // Tìm theo ID chính, nếu không thấy thử tìm theo triggerSignalId (fallback)
    let p = await ProposalModel.findById(id).lean();
    
    if (!p) {
      p = await ProposalModel.findOne({ 
        $or: [
          { triggerSignalId: new mongoose.Types.ObjectId(id) },
          { signalId: id }
        ] 
      }).lean();
    }
    
    if (!p) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Chuẩn hóa dữ liệu trả về
    const safeProposal = {
      _id: p._id.toString(),
      signalId: p.signalId || p.triggerSignalId || p.triggerEventId,
      tokenSymbol: p.tokenSymbol || (p.title ? p.title.split(' ')[0] : 'TOKEN'),
      tokenName: p.tokenName || p.title,
      action: p.action || (p.title?.toLowerCase().includes('sell') ? 'SELL' : 'BUY'),
      financialImpact: {
        currentValue: p.financialImpact?.currentValue || 0,
        projectedValue: p.financialImpact?.projectedValue || 0,
        riskLevel: (p.financialImpact?.riskLevel || 'MEDIUM').toUpperCase(),
        percentChange: p.financialImpact?.percentChange || 0,
      },
      summary: p.summary,
      reason: p.reason || [],
      // SỬA: Thêm sources để TheEvidence hiển thị
      sources: p.sources || [],
      // SỬA: Logic confidence giữ nguyên nhưng giờ Schema đã có field này nên sẽ lấy được giá trị từ DB
      confidence: p.confidence ? (p.confidence <= 1 ? Math.round(p.confidence * 100) : p.confidence) : 85,
      expiresAt: p.expiresAt,
      createdAt: p.createdAt,
      sentimentType: (p.financialImpact?.percentChange || 0) >= 0 ? 'positive' : 'negative'
    };

    return NextResponse.json(safeProposal);
  } catch (error: any) {
    console.error('💥 API Error:', error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}