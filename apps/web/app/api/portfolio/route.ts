import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import Proposal from '@/models/Proposal';

export const dynamic = 'force-dynamic';

type LegacyFinancialImpact = {
  roi?: number;
};

type WatchlistProposalRecord = {
  _id: mongoose.Types.ObjectId;
  confidence?: number;
  createdAt?: Date;
  executionStatus?: 'PENDING' | 'EXECUTED' | 'IGNORED';
  expiresAt?: Date;
  financialImpact?: LegacyFinancialImpact;
  status?: string;
  title?: string;
  tokenSymbol?: string;
};

type UserBalanceRecord = {
  tokenAddress: string;
  balance: string | number;
};

type UserPortfolioRecord = {
  _id: mongoose.Types.ObjectId;
  balances?: UserBalanceRecord[];
};

type TokenPriceRecord = {
  tokenKey?: string;
  tokenAddress: string;
  token?: mongoose.Types.ObjectId | string;
  priceUsd?: string | number;
  price?: number;
};

type TokenRecord = {
  _id: mongoose.Types.ObjectId;
  address?: string;
  coingeckoId?: string;
  symbol?: string;
};

type PerpPositionRecord = {
  _id: mongoose.Types.ObjectId;
  tokenSymbol?: string;
  tokenAddress?: string;
  entryPrice?: number;
  positionSize?: number;
  leverage?: number;
  positionDirection?: string;
  createdAt?: Date;
  proposalId?: mongoose.Types.ObjectId | string;
  roi?: number;
};

const ProposalModel = Proposal as unknown as mongoose.Model<WatchlistProposalRecord>;

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
    if (!db) {
      throw new Error('Database not connected');
    }

    // 2. Fetch user
    const user = await db.collection<UserPortfolioRecord>('users').findOne({ walletAddress: wallet });

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

    // 3. Fetch prices. token-price-fetcher writes by tokenKey
    // (for example coingecko:solana), while wallet balances use token mint addresses.
    const tokenAddresses = balances.map((b) => b.tokenAddress);
    const tokenDocs = await db
      .collection<TokenRecord>('tokens')
      .find({
        $or: [
          { address: { $in: tokenAddresses } },
          { coingeckoId: { $in: tokenAddresses } },
        ],
      })
      .toArray();

    const tokenByAddress = new Map<string, TokenRecord>();
    const tokenById = new Map<string, TokenRecord>();
    const priceKeys = new Set<string>(tokenAddresses);

    tokenDocs.forEach((token) => {
      tokenById.set(token._id.toString(), token);
      if (token.address) tokenByAddress.set(token.address, token);
      if (token.coingeckoId) {
        priceKeys.add(token.coingeckoId);
        priceKeys.add(`coingecko:${token.coingeckoId}`);
      }
    });

    const pricesDocs = await db
      .collection<TokenPriceRecord>('token_prices')
      .find({
        $or: [
          { tokenAddress: { $in: tokenAddresses } },
          { tokenKey: { $in: [...priceKeys] } },
        ],
      })
      .toArray();

    const priceMap = new Map<string, number>();
    // Default SOL price for devnet testing
    priceMap.set('So11111111111111111111111111111111111111112', 168.48);

    pricesDocs.forEach((p) => {
      const price = p.priceUsd !== undefined ? Number(p.priceUsd) : p.price || 0;
      if (!Number.isFinite(price) || price <= 0) return;

      if (p.tokenAddress) priceMap.set(p.tokenAddress, price);
      if (p.tokenKey) priceMap.set(p.tokenKey, price);

      const tokenId = p.token?.toString();
      const token = tokenId ? tokenById.get(tokenId) : undefined;
      if (token?.address) priceMap.set(token.address, price);
      if (token?.coingeckoId) priceMap.set(`coingecko:${token.coingeckoId}`, price);
    });

    // --- A. HOLDINGS ---
    let totalWalletValue = 0;

    const holdings = balances.map((b) => {
      const token = tokenByAddress.get(b.tokenAddress);
      const price =
        priceMap.get(b.tokenAddress) ||
        (token?.coingeckoId ? priceMap.get(`coingecko:${token.coingeckoId}`) : undefined) ||
        (token?.coingeckoId ? priceMap.get(token.coingeckoId) : undefined) ||
        0;
      const amountRaw = typeof b.balance === 'number' ? b.balance : parseFloat(b.balance);
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
      .collection<PerpPositionRecord>('perp_positions')
      .find({
        userId: userId,
        status: 'open'
      })
      .toArray();

    const investments = openPositions.map((p) => ({
      _id: p._id.toString(),
      symbol: p.tokenSymbol && p.tokenSymbol !== 'TOKEN' ? p.tokenSymbol : getTokenSymbol(p.tokenAddress || ''),
      entryPrice: normalizeNumber(p.entryPrice || 0),
      size: normalizeNumber(p.positionSize || 0),
      leverage: p.leverage || 1,             // <--- Add
      direction: p.positionDirection || 'LONG', // <--- Add
      createdAt: p.createdAt,              // <--- Add
      proposalId: p.proposalId,            // <--- Add
      pnl: 0,
      roi: normalizeNumber(p.roi || 0)
    }));

    // --- C. WATCHLIST ---
    const pendingProposals = await ProposalModel.find({
      $or: [
        { status: { $in: ['pending', 'active'] }, expiresAt: { $gt: new Date() } },
        { executionStatus: 'PENDING' },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean<WatchlistProposalRecord[]>();

    const watchlist = pendingProposals.map((p) => ({
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

  } catch (error) {
    console.error('Portfolio API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
