import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    await connectDB();

    // 1. Lấy danh sách trades từ collection "trades"
    const collection = mongoose.connection.db.collection("trades");
    const trades = await collection
      .find({ walletAddress }) 
      .sort({ executedAt: -1 }) // Mới nhất lên đầu
      .toArray();

    // 2. Chuyển đổi dữ liệu & Fix lỗi TypeScript
    // Sử dụng (t: any) để bypass lỗi kiểm tra kiểu dữ liệu nghiêm ngặt
    const safeTrades = trades.map((t: any) => ({
      ...t,
      _id: t._id.toString(),
      // Gán giá trị mặc định nếu thiếu trong DB
      status: t.status || 'OPEN',
      tokenSymbol: t.tokenSymbol || 'UNKNOWN',
      tokenName: t.tokenName || 'Unknown Token',
      
      // Ép kiểu số để tính toán an toàn
      currentPrice: Number(t.currentPrice) || 0,
      entryPrice: Number(t.entryPrice) || 0,
      amount: Number(t.amount) || 0,
      
      // Tính lại usdValue theo giá hiện tại
      usdValue: (Number(t.amount) || 0) * (Number(t.currentPrice) || 0),
      
      profitLoss: Number(t.profitLoss) || 0,
      profitLossPercent: Number(t.profitLossPercent) || 0,
      executedAt: t.executedAt || new Date().toISOString(),
    }));

    // 3. Tính toán các chỉ số tổng quan (Stats)
    let totalValue = 0;
    let totalInvested = 0;
    let totalProfit = 0;
    let winningTrades = 0;
    let closedTrades = 0;

    safeTrades.forEach(trade => {
      // Chỉ tính giá trị hiện tại cho các lệnh đang mở (OPEN)
      if (trade.status === 'OPEN') {
        totalValue += trade.usdValue;
        totalInvested += trade.amount * trade.entryPrice;
      }
      
      // Tính P/L tổng (cả lệnh đóng và mở)
      totalProfit += trade.profitLoss;

      // Tính Win Rate (chỉ trên các lệnh đã đóng)
      if (trade.status === 'CLOSED') {
        closedTrades++;
        if (trade.profitLoss > 0) {
          winningTrades++;
        }
      }
    });

    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
    const totalProfitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    const stats = {
      totalValue,
      totalInvested,
      totalProfitLoss: totalProfit,
      totalProfitLossPercent: totalProfitPercent,
      winRate: parseFloat(winRate.toFixed(2)),
    };

    return NextResponse.json({
      trades: safeTrades,
      stats
    });

  } catch (error) {
    console.error('Portfolio API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch portfolio data' },
      { status: 500 }
    );
  }
}