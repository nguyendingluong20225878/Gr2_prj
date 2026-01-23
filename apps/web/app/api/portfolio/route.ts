import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

// Import Tables từ Core
import { perpPositionsTable } from '../../../../../core/shared/src/db/schema/perp_positions';
import { transactionsTable } from '../../../../../core/shared/src/db/schema/transactions';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) return NextResponse.json({ error: 'Wallet required' }, { status: 400 });

    await connectDB();

    // BƯỚC 1: Tìm User ID từ Wallet Address
    // Chúng ta truy cập trực tiếp collection "users" để lấy ID mà không cần import User Model (tránh lỗi vòng lặp nếu có)
    const user = await mongoose.connection.db.collection('users').findOne({ walletAddress: wallet });

    if (!user) {
      // Nếu chưa có user trong DB thì trả về portfolio rỗng
      return NextResponse.json({ trades: [], stats: { totalTrades: 0, winRate: 0, totalPnL: 0 } });
    }

    const userId = user._id; // Đây là ObjectId

    // BƯỚC 2: Query dữ liệu dùng userId
    
    // Lấy vị thế đang mở (Perp Positions)
    const openPositions = await perpPositionsTable.find({ userId: userId }).lean();

    // Lấy lịch sử giao dịch (Transactions)
    const history = await transactionsTable.find({ userId: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // BƯỚC 3: Mapping dữ liệu sang format Frontend (Trade[])
    const trades = [
        // Map Open Positions
        ...openPositions.map((p: any) => ({
            _id: p._id.toString(),
            tokenSymbol: p.tokenAddress || 'UNK', // Nên có logic map address -> symbol nếu cần
            action: p.positionDirection === 'long' ? 'BUY' : 'SELL',
            status: 'OPEN',
            entryPrice: parseFloat(p.entryPrice) || 0,
            currentPrice: parseFloat(p.entryPrice), // Cần lấy giá realtime nếu có, tạm thời dùng entry
            amount: parseFloat(p.positionSize) || 0,
            pnl: 0, // Vị thế mở tạm thời tính PnL = 0 hoặc tính theo markPrice
            executedAt: p.createdAt || new Date(),
        })),
        // Map Transactions (Closed/History)
        ...history.map((t: any) => ({
            _id: t._id.toString(),
            tokenSymbol: t.fromTokenAddress || 'SOL', // Placeholder
            action: t.transactionType === 'swap' ? 'SWAP' : 'TRADE',
            status: 'CLOSED',
            entryPrice: 0,
            amount: parseFloat(t.amountFrom) || 0,
            pnl: 0, 
            executedAt: t.createdAt,
        }))
    ];

    // Tính Stats đơn giản
    const stats = {
      totalTrades: trades.length,
      winRate: 0, 
      totalPnL: 0
    };

    return NextResponse.json({ trades, stats });

  } catch (error) {
    console.error('Portfolio API Error:', error);
    return NextResponse.json({ error: 'Internal Error', details: String(error) }, { status: 500 });
  }
}