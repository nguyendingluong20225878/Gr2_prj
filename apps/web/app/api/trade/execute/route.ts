import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function POST(req: Request) {
  try {
    // 1. Nhận dữ liệu từ Frontend gửi lên
    const body = await req.json();
    const { 
      userId, 
      tokenSymbol, 
      tokenAddress, 
      amount, 
      entryPrice, 
      direction, // 'LONG' hoặc 'SHORT'
      leverage,
      proposalId 
    } = body;

    if (!userId || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();
    const db = mongoose.connection.db;

    // 2. Tạo bản ghi mới vào bảng 'perp_positions'
    // Đây chính là hành động biến "Pending" thành "Active Investment"
    const newPosition = {
      userId: new mongoose.Types.ObjectId(userId),
      proposalId: proposalId ? new mongoose.Types.ObjectId(proposalId) : null,
      tokenSymbol: tokenSymbol,
      tokenAddress: tokenAddress || 'UNKNOWN_ADDR', // Cần address để Portfolio mapping giá
      positionType: 'PERPETUAL',
      positionDirection: direction || 'LONG',
      leverage: leverage || 1,
      entryPrice: parseFloat(entryPrice),
      markPrice: parseFloat(entryPrice), // Giá hiện tại = Giá vào lệnh
      liquidationPrice: 0, // Tính sau
      positionSize: parseFloat(amount), // Giá trị USD
      collateral: parseFloat(amount),
      pnl: 0,
      roi: 0,
      status: 'open', // <--- QUAN TRỌNG: Trạng thái là 'open' để hiện trong Portfolio
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('perp_positions').insertOne(newPosition);

    // 3. (Tùy chọn) Cập nhật trạng thái Proposal gốc thành 'EXECUTED' nếu muốn
    // await db.collection('proposals').updateOne({ _id: new mongoose.Types.ObjectId(proposalId) }, { $set: { status: 'EXECUTED' } });

    return NextResponse.json({ success: true, positionId: result.insertedId });

  } catch (error: any) {
    console.error('Execute Trade Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}