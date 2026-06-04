import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import Proposal from '@/models/Proposal';
import { requireSessionUser } from '@/server/auth/walletAuth';
import { resolveToken } from '@gr2/shared';

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
  token?: mongoose.Types.ObjectId | string;
  tokenAddress: string;
  balance: string | number;
};

type UserPortfolioRecord = {
  _id: mongoose.Types.ObjectId;
  balances?: UserBalanceRecord[];
};

type TokenPriceRecord = {
  tokenKey?: string;
  tokenAddress?: string;
  token?: mongoose.Types.ObjectId | string;
  priceUsd?: string | number;
  price?: number;
};

type TokenRecord = {
  _id: mongoose.Types.ObjectId;
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
  executedPrice?: number;
  executionId?: mongoose.Types.ObjectId | string;
  proposalId?: mongoose.Types.ObjectId | string;
  requestedPrice?: number;
  roi?: number;
  slippagePct?: number;
  txHash?: string;
};

type HoldingPriceQuality = 'OK' | 'MISSING_PRICE';
type MissingPriceReason = 'NO_TOKEN_MAPPING' | 'NO_PRICE';

const ProposalModel = Proposal as unknown as mongoose.Model<WatchlistProposalRecord>;

/** Helper: Normalize number (15.0000 -> 15) */
const normalizeNumber = (n: number) => {
  return Number.isInteger(n) ? n : parseFloat(n.toString());
};

const normalizeNullableNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? normalizeNumber(n) : null;
};

const UNKNOWN_TOKEN_SYMBOL = 'Token chưa định danh';

export async function GET(req: Request) {
  try {
    const session = await requireSessionUser(req);
    const wallet = session.walletAddress;

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
        stats: {
          totalValue: 0,
          pricedHoldingsCount: 0,
          missingPriceCount: 0,
          totalValueStatus: 'COMPLETE',
        }
      });
    }

    const userId = user._id;
    const balances = user.balances || [];

    // 3. Resolve balances through the core token identity resolver.
    const resolvedBalances = await Promise.all(balances.map(async (balance) => {
      const existingTokenId = balance.token?.toString();
      if (existingTokenId && mongoose.Types.ObjectId.isValid(existingTokenId)) {
        return { balance, tokenId: new mongoose.Types.ObjectId(existingTokenId) };
      }

      const token = await resolveToken({
        chain: 'solana',
        addressOrMint: balance.tokenAddress,
      });

      return {
        balance,
        tokenId: token?._id && mongoose.Types.ObjectId.isValid(String(token._id))
          ? new mongoose.Types.ObjectId(String(token._id))
          : null,
      };
    }));

    const tokenIds = [...new Map(
      resolvedBalances
        .map((item) => item.tokenId)
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id))
        .map((id) => [id.toString(), id])
    ).values()];

    const tokenDocs = tokenIds.length
      ? await db
          .collection<TokenRecord>('tokens')
          .find({ _id: { $in: tokenIds } })
          .toArray()
      : [];

    const tokenById = new Map<string, TokenRecord>();
    tokenDocs.forEach((token) => tokenById.set(token._id.toString(), token));

    const pricesDocs = await db
      .collection<TokenPriceRecord>('token_prices')
      .find({
        token: { $in: [...tokenIds, ...tokenIds.map((id) => id.toString())] },
      })
      .toArray();

    const priceMap = new Map<string, number>();
    pricesDocs.forEach((p) => {
      const price = p.priceUsd !== undefined ? Number(p.priceUsd) : Number(p.price);
      if (!Number.isFinite(price) || price <= 0) return;
      const tokenId = p.token?.toString();
      if (tokenId) priceMap.set(tokenId, price);
    });

    // --- A. HOLDINGS ---
    let totalWalletValue = 0;
    let pricedHoldingsCount = 0;
    let missingPriceCount = 0;

    const holdings = resolvedBalances.map(({ balance: b, tokenId }) => {
      const token = tokenId ? tokenById.get(tokenId.toString()) : undefined;
      const price = tokenId ? priceMap.get(tokenId.toString()) ?? null : null;
      const amount = normalizeNullableNumber(b.balance) ?? 0;
      const dataQuality: HoldingPriceQuality = price === null ? 'MISSING_PRICE' : 'OK';
      const missingReason: MissingPriceReason | undefined = price === null
        ? token
          ? 'NO_PRICE'
          : 'NO_TOKEN_MAPPING'
        : undefined;

      const valueUsdRaw = price === null ? null : amount * price;
      const valueUsd = valueUsdRaw === null ? null : normalizeNumber(valueUsdRaw);

      if (valueUsd !== null) {
        pricedHoldingsCount += 1;
        if (valueUsd > 0) totalWalletValue += valueUsd;
      } else {
        missingPriceCount += 1;
      }

      return {
        tokenAddress: b.tokenAddress,
        symbol: token?.symbol ?? UNKNOWN_TOKEN_SYMBOL,
        balance: amount,
        price: price === null ? null : normalizeNumber(price),
        value: valueUsd,
        dataQuality,
        missingReason,
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
      symbol: p.tokenSymbol && p.tokenSymbol !== 'TOKEN' ? p.tokenSymbol : UNKNOWN_TOKEN_SYMBOL,
      entryPrice: normalizeNullableNumber(p.entryPrice),
      size: normalizeNullableNumber(p.positionSize),
      leverage: p.leverage || 1,             // <--- Add
      direction: p.positionDirection || 'LONG', // <--- Add
      createdAt: p.createdAt,              // <--- Add
      executedPrice: normalizeNullableNumber(p.executedPrice ?? p.entryPrice),
      executionId: p.executionId?.toString(),
      proposalId: p.proposalId,            // <--- Add
      requestedPrice: normalizeNullableNumber(p.requestedPrice ?? p.entryPrice),
      slippagePct: normalizeNullableNumber(p.slippagePct),
      txHash: p.txHash,
      pnl: null,
      roi: normalizeNullableNumber(p.roi)
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
      tokenSymbol: p.tokenSymbol || null,
      title: p.title,
      roi: normalizeNullableNumber(p.financialImpact?.roi),
      confidence: p.confidence,
      createdAt: p.createdAt
    }));

    const totalValue = holdings.length > 0 && pricedHoldingsCount === 0
      ? null
      : normalizeNumber(totalWalletValue);
    const totalValueStatus = holdings.length > 0 && pricedHoldingsCount === 0
      ? 'MISSING_PRICE_DATA'
      : missingPriceCount > 0
        ? 'PARTIAL'
        : 'COMPLETE';

    const stats = {
      totalValue,
      activeCount: investments.length,
      watchlistCount: watchlist.length,
      pricedHoldingsCount,
      missingPriceCount,
      totalValueStatus,
    };

    return NextResponse.json({ holdings, investments, watchlist, stats });

  } catch (error) {
    console.error('Portfolio API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && error.name === 'AuthRequiredError' ? 401 : 500 }
    );
  }
}
