import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
// Import Schema từ Core
import { ProposalModel as RawProposalModel } from '../../../../../../core/proposal-generator/src/db/schema/proposals';

const ProposalModel = RawProposalModel as mongoose.Model<any>;

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    // 1. Tìm theo ID chính
    let p = await ProposalModel.findById(id).lean();
    
    // 2. Fallback: Tìm theo ID của Signal gốc (triggerEventId)
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

    // --- LOGIC XÁC ĐỊNH ACTION (Đã sửa lỗi màu sắc) ---
    let finalAction = 'HOLD'; // Mặc định an toàn là HOLD (Màu Tím)

    // Ưu tiên 1: Lấy trực tiếp từ trường 'type' trong DB (đã có trong Schema)
    if (p.type) {
      finalAction = p.type.toUpperCase();
    } 
    // Ưu tiên 2: Lấy từ trường 'action' (nếu có - legacy)
    else if (p.action) {
      finalAction = p.action.toUpperCase();
    }
    // Ưu tiên 3: Đoán từ tiêu đề (Fallback thông minh hơn)
    else {
      const title = p.title?.toLowerCase() || '';
      if (title.includes('sell') || title.includes('close')) {
        finalAction = 'SELL';
      } else if (title.includes('buy') || title.includes('long') || title.includes('initiate') || title.includes('increase')) {
        finalAction = 'BUY';
      } else {
        finalAction = 'HOLD';
      }
    }

    // Chuẩn hóa dữ liệu trả về
    const safeProposal = {
      _id: p._id.toString(),
      signalId: p.triggerEventId || p.triggerSignalId || p.signalId,
      tokenSymbol: p.tokenSymbol || (p.title ? p.title.split(' ')[0] : 'TOKEN'),
      tokenName: p.tokenName || p.title,
      
      // Sử dụng action đã tính toán kỹ ở trên
      action: finalAction,
      
      financialImpact: {
        currentValue: p.financialImpact?.currentValue || 0,
        projectedValue: p.financialImpact?.projectedValue || 0,
        riskLevel: (p.financialImpact?.riskLevel || 'MEDIUM').toUpperCase(),
        percentChange: p.financialImpact?.percentChange || 0,
      },
      summary: p.summary,
      reason: p.reason || [],
      sources: p.sources || [],
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