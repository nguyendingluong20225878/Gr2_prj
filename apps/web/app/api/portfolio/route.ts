import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

// Import Proposal Model (DB Local)
import { ProposalModel as RawProposalModel } from '../../../../../core/proposal-generator/src/db/schema/proposals';
const ProposalModel = RawProposalModel as unknown as mongoose.Model<any>;

/** Helper: Normalize number (15.0000 -> 15) */
const normalizeNumber = (n: number) => {
  return Number.isInteger(n) ? n : parseFloat(n.toString());
};

const getTokenSymbol = (addr: string) => {
  if (!addr) return 'UNKNOWN';
  if (addr === 'So11111111111111111111111111111111111111112') return 'SOL';
  if (addr.startsWith('EPj')) return 'USDC';
  if (addr.startsWith('JUP')) return 'JUP';
  if (addr.startsWith('Es9')) return 'USDT';
  if (addr === '6wrnLa6tkusRwKjGjTLyFG1czhNoNYF5pJg1wPhGg4bD') return 'SPL-TK';
  return addr.slice(0, 4);
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
    }

    // 1. Connect DB
    await connectDB();

    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }

    const db = mongoose.connection.db;

    // 2. Fetch user
    const user = await db.collection('users').findOne({ walletAddress: wallet });

    console.log(`[Portfolio] Fetching for wallet: ${wallet}`);

    if (!user) {
      return NextResponse.json({
        holdings: [],
        investments: [],
        watchlist: [],
        stats: { totalValue: 0 }
      });
    }

    const userId = user._id;
    const balances = user.balances || [];

    // 3. Fetch prices
    const tokenAddresses = balances.map((b: any) => b.tokenAddress);

    const pricesDocs = await db
      .collection('token_prices')
      .find({ tokenAddress: { $in: tokenAddresses } })
      .toArray();

    const priceMap = new Map<string, number>();
    // Default SOL price for devnet testing
    priceMap.set('So11111111111111111111111111111111111111112', 168.48);

    pricesDocs.forEach((p: any) => {
      const price = p.priceUsd ? parseFloat(p.priceUsd) : p.price || 0;
      priceMap.set(p.tokenAddress, price);
    });

    // --- A. HOLDINGS ---
    let totalWalletValue = 0;

    const holdings = balances.map((b: any) => {
      const price = priceMap.get(b.tokenAddress) || 0;
      const amountRaw = parseFloat(b.balance);
      const amount = normalizeNumber(amountRaw);

      const valueUsdRaw = amount * price;
      const valueUsd = normalizeNumber(valueUsdRaw);

      if (valueUsd > 0) totalWalletValue += valueUsd;

      return {
        symbol: getTokenSymbol(b.tokenAddress),
        balance: amount,
        price: normalizeNumber(price),
        value: valueUsd
      };
    });

    // --- B. ACTIVE INVESTMENTS (Updated Fields) ---
    const openPositions = await db
      .collection('perp_positions')
      .find({
        userId: userId,
        status: 'open'
      })
      .toArray();

    const investments = openPositions.map((p: any) => ({
      _id: p._id.toString(),
      symbol: p.tokenSymbol !== 'TOKEN' ? p.tokenSymbol : getTokenSymbol(p.tokenAddress),
      entryPrice: normalizeNumber(p.entryPrice),
      size: normalizeNumber(p.positionSize),
      leverage: p.leverage || 1,             // <--- Add
      direction: p.positionDirection || 'LONG', // <--- Add
      createdAt: p.createdAt,              // <--- Add
      proposalId: p.proposalId,            // <--- Add
      pnl: 0,
      roi: normalizeNumber(p.roi || 0)
    }));

    // --- C. WATCHLIST ---
    const pendingProposals = await ProposalModel.find({
      status: { $in: ['pending', 'active'] },
      expiresAt: { $gt: new Date() }
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const watchlist = pendingProposals.map((p: any) => ({
      _id: p._id.toString(),
      tokenSymbol: p.tokenSymbol || (p.title ? p.title.split(' ')[0] : 'TOKEN'),
      title: p.title,
      roi: normalizeNumber(p.financialImpact?.roi || 0),
      confidence: p.confidence,
      createdAt: p.createdAt
    }));

    const stats = {
      totalValue: normalizeNumber(totalWalletValue),
      activeCount: investments.length,
      watchlistCount: watchlist.length
    };

    return NextResponse.json({ holdings, investments, watchlist, stats });

  } catch (error: any) {
    console.error('Portfolio API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Error' },
      { status: 500 }
    );
  }
}