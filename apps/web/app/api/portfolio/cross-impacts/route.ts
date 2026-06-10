import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { requireSessionUser } from '@/server/auth/walletAuth';
import { resolveToken } from '@gr2/shared';

export const dynamic = 'force-dynamic';

type UserBalanceRecord = {
  token?: mongoose.Types.ObjectId | string;
  tokenAddress: string;
  balance?: string | number;
};

type UserPortfolioRecord = {
  balances?: UserBalanceRecord[];
};

type TokenRecord = {
  _id: mongoose.Types.ObjectId;
  symbol?: string;
};

type NewsArticleRecord = {
  _id: mongoose.Types.ObjectId;
  articleUrl: string;
  title?: string;
  summary?: string;
  detectedTokens?: string[];
  publishedAt?: Date | null;
  scrapedAt?: Date;
};

type ProposalRecord = {
  _id: mongoose.Types.ObjectId;
  tokenSymbol?: string | null;
  confidence?: number | null;
  quantScore?: number | null;
  sources?: Array<{ url?: string; sourceKey?: string; label?: string }>;
};

const UNKNOWN_TOKEN_SYMBOL = 'TOKEN CHƯA ĐỊNH DANH';

function normalizeSymbol(value?: string | null) {
  const symbol = String(value ?? '').trim().toUpperCase();
  return symbol && symbol !== UNKNOWN_TOKEN_SYMBOL ? symbol : null;
}

function normalizeUrl(value?: string | null) {
  return String(value ?? '').trim();
}

function canonicalSourceUrl(value?: string | null) {
  const raw = normalizeUrl(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return raw.replace(/[?#].*$/, '').replace(/\/$/, '');
  }
}

function escapedRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function confidenceToPercent(value?: number | null) {
  if (!Number.isFinite(Number(value))) return null;
  const n = Number(value);
  return Math.abs(n) <= 1 ? n * 100 : n;
}

async function resolveHoldingSymbols(db: mongoose.mongo.Db, user: UserPortfolioRecord | null) {
  const balances = user?.balances ?? [];
  const resolved = await Promise.all(balances.map(async (balance) => {
    const existingTokenId = balance.token?.toString();
    if (existingTokenId && mongoose.Types.ObjectId.isValid(existingTokenId)) {
      return new mongoose.Types.ObjectId(existingTokenId);
    }

    const token = await resolveToken({
      chain: 'solana',
      addressOrMint: balance.tokenAddress,
    });

    return token?._id && mongoose.Types.ObjectId.isValid(String(token._id))
      ? new mongoose.Types.ObjectId(String(token._id))
      : null;
  }));

  const tokenIds = [...new Map(
    resolved
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id))
      .map((id) => [id.toString(), id])
  ).values()];

  const tokenDocs = tokenIds.length
    ? await db.collection<TokenRecord>('tokens').find({ _id: { $in: tokenIds } }).toArray()
    : [];

  return new Set(
    tokenDocs
      .map((token) => normalizeSymbol(token.symbol))
      .filter((symbol): symbol is string => Boolean(symbol))
  );
}

export async function GET(req: Request) {
  try {
    const session = await requireSessionUser(req);
    await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const user = await db.collection<UserPortfolioRecord>('users').findOne({ walletAddress: session.walletAddress });
    const holdingSymbols = await resolveHoldingSymbols(db, user);
    if (!holdingSymbols.size) return NextResponse.json([]);

    const articles = await db.collection<NewsArticleRecord>('news_articles')
      .find({
        detectedTokens: { $in: [...holdingSymbols] },
        $expr: { $gte: [{ $size: { $ifNull: ['$detectedTokens', []] } }, 2] },
      })
      .sort({ publishedAt: -1, scrapedAt: -1 })
      .limit(40)
      .toArray();

    if (!articles.length) return NextResponse.json([]);

    const candidateTokens = new Set<string>();
    articles.forEach((article) => {
      (article.detectedTokens ?? []).forEach((token) => {
        const symbol = normalizeSymbol(token);
        if (symbol && !holdingSymbols.has(symbol)) candidateTokens.add(symbol);
      });
    });

    const proposalRows = candidateTokens.size
      ? await db.collection<ProposalRecord>('proposals')
          .find({
            tokenSymbol: { $in: [...candidateTokens].map((token) => new RegExp(`^${escapedRegex(token)}$`, 'i')) },
            sources: { $exists: true, $ne: [] },
          })
          .project({ _id: 1, tokenSymbol: 1, confidence: 1, quantScore: 1, sources: 1 })
          .toArray() as unknown as ProposalRecord[]
      : [];

    const proposalsByUrlAndToken = new Map<string, ProposalRecord[]>();
    proposalRows.forEach((proposal) => {
      const token = normalizeSymbol(proposal.tokenSymbol);
      if (!token) return;
      (proposal.sources ?? []).forEach((source: { url?: string; sourceKey?: string; label?: string }) => {
        const url = canonicalSourceUrl(source.url);
        if (!url) return;
        const key = `${url}::${token}`;
        const rows = proposalsByUrlAndToken.get(key) ?? [];
        rows.push(proposal);
        proposalsByUrlAndToken.set(key, rows);
      });
    });

    const impacts = articles.flatMap((article) => {
      const tokens = [...new Set((article.detectedTokens ?? []).map(normalizeSymbol).filter((token): token is string => Boolean(token)))];
      const matchedHoldings = tokens.filter((token) => holdingSymbols.has(token));
      const impactedTokens = tokens.filter((token) => !holdingSymbols.has(token));
      if (!matchedHoldings.length || !impactedTokens.length) return [];

      const proposalIds = impactedTokens.flatMap((token) => {
        const rows = proposalsByUrlAndToken.get(`${canonicalSourceUrl(article.articleUrl)}::${token}`) ?? [];
        return rows.map((proposal) => proposal._id.toString());
      });

      const confidenceValues = impactedTokens.flatMap((token) => {
        const rows = proposalsByUrlAndToken.get(`${canonicalSourceUrl(article.articleUrl)}::${token}`) ?? [];
        return rows.map((proposal) => confidenceToPercent(proposal.confidence)).filter((value): value is number => value !== null);
      });

      const confidence = confidenceValues.length
        ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
        : null;

      return [{
        sourceId: article._id.toString(),
        sourceLabel: article.title || 'Nguồn tin có nhiều token liên quan',
        sourceUrl: article.articleUrl,
        sourceType: 'news',
        holdingTokens: matchedHoldings,
        impactedTokens,
        proposalIds: [...new Set(proposalIds)],
        confidence,
        weight: proposalIds.length ? 1 : 0.5,
        reason: `Nguồn này nhắc tới ${matchedHoldings.join(', ')} trong danh mục của bạn cùng với ${impactedTokens.join(', ')}, nên ${impactedTokens.join(', ')} được đưa vào danh sách tài sản liên quan để cân nhắc.`,
        createdAt: (article.publishedAt ?? article.scrapedAt ?? new Date()).toISOString(),
      }];
    }).slice(0, 10);

    return NextResponse.json(impacts);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && error.name === 'AuthRequiredError' ? 401 : 500 }
    );
  }
}
