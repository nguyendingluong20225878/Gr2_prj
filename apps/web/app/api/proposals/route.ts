import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import Proposal from '@/models/Proposal';
import { PROPOSAL_TTL_MS } from '@/app/config/proposals';
import { resolveToken, tokenPriceHistory } from '@gr2/shared';

export const dynamic = 'force-dynamic';

type LegacyFinancialImpact = {
  currentPrice?: number;
  currentValue?: number;
  projectedPnL?: number;
  projectedValue?: number;
  targetPrice?: number;
  riskLevel?: string;
  roi?: number;
  percentChange?: number;
};

type ProposalListRecord = {
  _id: mongoose.Types.ObjectId;
  action?: string;
  confidence?: number;
  createdAt?: Date;
  executionStatus?: 'PENDING' | 'EXECUTED' | 'IGNORED';
  expiresAt?: Date;
  financialImpact?: LegacyFinancialImpact;
  reason?: string[];
  sentimentType?: string;
  signalId?: mongoose.Types.ObjectId;
  sources?: Array<{ label?: string; name?: string; url?: string; sourceKey?: string; weight?: number }>;
  entryPrice?: number;
  exitPrice?: number;
  actualPnL?: number;
  winLossStatus?: string;
  backtestedAt?: Date;
  backtestMeta?: Record<string, unknown>;
  pnlPercentage?: number;
  quantScore?: number;
  lifecycleStatus?: 'ACTIVE' | 'EXPIRED' | 'OVERRIDDEN';
  status?: string;
  summary?: string;
  suggestionType?: string;
  title?: string;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  updatedAt?: Date;
};

type PriceHistoryRecord = {
  token?: mongoose.Types.ObjectId | string;
  tokenAddress?: string;
  priceUsd?: string | number;
  timestamp?: Date;
};

type PricePoint = {
  price: number;
  timestamp: Date;
};

type LivePerformance = {
  entryPrice: number | null;
  entryMatchedAt: string | null;
  markPrice: number | null;
  markMatchedAt: string | null;
  roiPct: number | null;
  pnlStatus: 'AVAILABLE' | 'NO_ENTRY_PRICE' | 'NO_MARK_PRICE' | 'UNSUPPORTED_ACTION';
  basis: 'MARK_TO_MARKET';
};

const ProposalModel = Proposal as unknown as mongoose.Model<ProposalListRecord>;
const PriceHistoryModel = tokenPriceHistory as unknown as mongoose.Model<PriceHistoryRecord>;
const EXPIRED_AUDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LIVE_ENTRY_MAX_DISTANCE_MS = 6 * 60 * 60 * 1000;

function normalizeAction(value?: string): 'BUY' | 'SELL' | 'HOLD' | 'UNKNOWN' {
  const upper = String(value ?? '').toUpperCase();
  if (upper === 'BUY' || upper === 'SELL' || upper === 'HOLD') return upper;
  return 'UNKNOWN';
}

function deriveExpiresAt(createdAt?: Date) {
  return new Date((createdAt?.getTime() ?? Date.now()) + PROPOSAL_TTL_MS);
}

function hasBacktestResult(proposal: ProposalListRecord) {
  return Boolean(
    proposal.backtestedAt ||
    proposal.winLossStatus ||
    proposal.pnlPercentage !== null && proposal.pnlPercentage !== undefined
  );
}

function deriveLifecycleStatus(proposal: ProposalListRecord, expiresAt: Date, now: Date) {
  if (proposal.lifecycleStatus) return proposal.lifecycleStatus;
  return expiresAt <= now ? 'EXPIRED' : 'ACTIVE';
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean))];
}

function normalizeLiveAction(value?: string) {
  const upper = String(value ?? '').toUpperCase();
  if (upper === 'BUY' || upper === 'LONG') return 'LONG';
  if (upper === 'SELL' || upper === 'SHORT') return 'SHORT';
  if (upper === 'HOLD' || upper === 'WAIT') return 'FLAT';
  return null;
}

function getBacktestMetaDate(proposal: ProposalListRecord, key: string) {
  const value = proposal.backtestMeta?.[key];
  const date = value ? new Date(value as string | number | Date) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function getLiveEntryTime(proposal: ProposalListRecord) {
  return getBacktestMetaDate(proposal, 'detectedAt') ?? (proposal.createdAt ?? null);
}

function nearestPricePoint(time: number, pricePoints: PricePoint[]) {
  if (!pricePoints.length) return null;
  return pricePoints.reduce((best, point) => (
    Math.abs(point.timestamp.getTime() - time) < Math.abs(best.timestamp.getTime() - time) ? point : best
  ), pricePoints[0]);
}

async function getProposalPriceKeys(proposal: ProposalListRecord) {
  const resolvedToken = await resolveToken({
    chain: 'solana',
    addressOrMint: proposal.tokenAddress,
    coingeckoId: proposal.tokenAddress,
    symbol: proposal.tokenSymbol,
    tokenKey: proposal.tokenAddress,
  }).catch(() => null);
  const resolvedTokenId = resolvedToken?._id && mongoose.Types.ObjectId.isValid(String(resolvedToken._id))
    ? new mongoose.Types.ObjectId(String(resolvedToken._id))
    : null;

  return {
    addressKeys: uniqueStrings([
      proposal.tokenAddress,
      proposal.tokenSymbol,
      proposal.tokenName,
      resolvedToken?.address,
      resolvedToken?.primaryAddress,
      resolvedToken?.canonicalKey,
      resolvedToken?.coingeckoId,
      ...(resolvedToken?.aliases ?? []).map((alias: { value?: string }) => alias.value),
    ]),
    tokenIds: resolvedTokenId ? [resolvedTokenId] : [],
  };
}

function computeLivePerformance(proposal: ProposalListRecord, pricePoints: PricePoint[]): LivePerformance {
  const action = normalizeLiveAction(proposal.action ?? proposal.suggestionType);
  if (!action) {
    return {
      entryPrice: null,
      entryMatchedAt: null,
      markPrice: null,
      markMatchedAt: null,
      roiPct: null,
      pnlStatus: 'UNSUPPORTED_ACTION',
      basis: 'MARK_TO_MARKET',
    };
  }

  const mark = pricePoints[pricePoints.length - 1] ?? null;
  if (!mark) {
    return {
      entryPrice: null,
      entryMatchedAt: null,
      markPrice: null,
      markMatchedAt: null,
      roiPct: null,
      pnlStatus: 'NO_MARK_PRICE',
      basis: 'MARK_TO_MARKET',
    };
  }

  const entryReference = getLiveEntryTime(proposal);
  const entryReferenceTime = entryReference ? new Date(entryReference).getTime() : NaN;
  const entry = Number.isFinite(entryReferenceTime) ? nearestPricePoint(entryReferenceTime, pricePoints) : null;
  const entryDistanceMs = entry && Number.isFinite(entryReferenceTime)
    ? Math.abs(entry.timestamp.getTime() - entryReferenceTime)
    : Number.POSITIVE_INFINITY;
  const entryNearSignal = entry && entryDistanceMs <= LIVE_ENTRY_MAX_DISTANCE_MS ? entry : null;
  const fallbackEntryPrice = nullableNumber(
    proposal.entryPrice ??
    proposal.financialImpact?.currentPrice ??
    proposal.financialImpact?.currentValue
  );
  const entryPrice = entryNearSignal?.price && entryNearSignal.price > 0 ? entryNearSignal.price : fallbackEntryPrice;

  if (entryPrice === null || entryPrice <= 0) {
    return {
      entryPrice: null,
      entryMatchedAt: null,
      markPrice: mark.price,
      markMatchedAt: mark.timestamp.toISOString(),
      roiPct: null,
      pnlStatus: 'NO_ENTRY_PRICE',
      basis: 'MARK_TO_MARKET',
    };
  }

  const roiPct = action === 'SHORT'
    ? ((entryPrice - mark.price) / entryPrice) * 100
    : ((mark.price - entryPrice) / entryPrice) * 100;

  return {
    entryPrice,
    entryMatchedAt: entryNearSignal?.timestamp.toISOString() ?? null,
    markPrice: mark.price,
    markMatchedAt: mark.timestamp.toISOString(),
    roiPct,
    pnlStatus: 'AVAILABLE',
    basis: 'MARK_TO_MARKET',
  };
}

async function buildLivePerformanceByProposalId(proposals: ProposalListRecord[]) {
  const activeProposals = proposals.filter((proposal) => !hasBacktestResult(proposal));
  if (!activeProposals.length) return new Map<string, LivePerformance>();

  const keyEntries = await Promise.all(activeProposals.map(async (proposal) => ({
    id: proposal._id.toString(),
    proposal,
    priceKeys: await getProposalPriceKeys(proposal),
  })));
  const allAddressKeys = uniqueStrings(keyEntries.flatMap((entry) => entry.priceKeys.addressKeys));
  const tokenIdMap = new Map<string, mongoose.Types.ObjectId>();
  keyEntries
    .flatMap((entry) => entry.priceKeys.tokenIds)
    .forEach((id) => tokenIdMap.set(id.toString(), id));
  const allTokenIds = Array.from(tokenIdMap.values());
  if (!allAddressKeys.length && !allTokenIds.length) return new Map<string, LivePerformance>();

  const earliestCreatedAt = keyEntries
    .map((entry) => getLiveEntryTime(entry.proposal)?.getTime())
    .filter((time): time is number => Number.isFinite(time))
    .sort((a, b) => a - b)[0];
  const now = new Date();
  const from = earliestCreatedAt ? new Date(earliestCreatedAt - 6 * 60 * 60 * 1000) : undefined;
  const priceOrFilters: Record<string, unknown>[] = [];
  if (allAddressKeys.length) priceOrFilters.push({ tokenAddress: { $in: allAddressKeys } });
  if (allTokenIds.length) priceOrFilters.push({ token: { $in: allTokenIds } });
  const priceQuery: Record<string, unknown> = priceOrFilters.length === 1 ? priceOrFilters[0] : { $or: priceOrFilters };
  priceQuery.timestamp = {
    ...(from ? { $gte: from } : {}),
    $lte: now,
  };

  const rows = await PriceHistoryModel.find(priceQuery)
    .sort({ timestamp: 1 })
    .limit(20000)
    .lean<PriceHistoryRecord[]>();
  const rowsByKey = new Map<string, PricePoint[]>();
  rows.forEach((row) => {
    const rowKeys = uniqueStrings([row.tokenAddress, row.token ? String(row.token) : null]);
    const price = nullableNumber(row.priceUsd);
    const timestamp = row.timestamp ? new Date(row.timestamp) : null;
    if (!rowKeys.length || price === null || !timestamp || !Number.isFinite(timestamp.getTime())) return;
    rowKeys.forEach((key) => {
      const points = rowsByKey.get(key) ?? [];
      points.push({ price, timestamp });
      rowsByKey.set(key, points);
    });
  });

  const livePerformanceById = new Map<string, LivePerformance>();
  keyEntries.forEach(({ id, proposal, priceKeys }) => {
    const keys = [...priceKeys.addressKeys, ...priceKeys.tokenIds.map((tokenId) => tokenId.toString())];
    const points = keys
      .flatMap((key) => rowsByKey.get(key) ?? [])
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    livePerformanceById.set(id, computeLivePerformance(proposal, points));
  });

  return livePerformanceById;
}

export async function GET() {
  try {
    await connectDB();
    
    const now = new Date();
    const legacyCreatedAfter = new Date(now.getTime() - PROPOSAL_TTL_MS);
    const expiredAuditAfter = new Date(now.getTime() - EXPIRED_AUDIT_WINDOW_MS);
    const query = {
      $or: [
        { lifecycleStatus: 'ACTIVE', expiresAt: { $gt: now }, executionStatus: 'PENDING' },
        { lifecycleStatus: 'EXPIRED', backtestedAt: { $exists: false }, updatedAt: { $gte: expiredAuditAfter } },
        { expiresAt: { $lte: now, $gte: expiredAuditAfter }, backtestedAt: { $exists: false }, winLossStatus: { $exists: false }, pnlPercentage: { $exists: false } },
        { backtestedAt: { $exists: true, $ne: null } },
        { winLossStatus: { $exists: true, $ne: null } },
        { pnlPercentage: { $exists: true, $ne: null } },
        {
          lifecycleStatus: { $exists: false },
          status: { $in: ['pending', 'active', 'open', 'trade', 'opportunity', 'ACTIVE'] },
          $or: [
            { expiresAt: { $gt: now } },
            { expiresAt: { $exists: false }, createdAt: { $gte: legacyCreatedAfter } },
          ],
        },
      ],
    };

    const proposals = await ProposalModel.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean<ProposalListRecord[]>();
    const livePerformanceById = await buildLivePerformanceByProposalId(proposals);

    const safeProposals = proposals.map((p) => {
      const action = normalizeAction(p.action ?? p.suggestionType);
      const roi = nullableNumber(p.financialImpact?.roi);

      // Chuẩn hóa confidence
      const rawConfidence = typeof p.confidence === 'number' ? p.confidence : null;
      const confidence = rawConfidence === null
        ? null
        : rawConfidence <= 1
          ? Math.round(rawConfidence * 100)
          : rawConfidence;
      const sentimentType = p.sentimentType ?? 'unknown';

      const expiresAt = p.expiresAt ?? deriveExpiresAt(p.createdAt);
      const lifecycleStatus = deriveLifecycleStatus(p, expiresAt, now);

      return {
        _id: p._id.toString(),
        tokenSymbol: p.tokenSymbol || null,
        tokenName: p.tokenName || p.title || null,
        action: action,
        financialImpact: {
          currentPrice: nullableNumber(p.financialImpact?.currentPrice),
          currentValue: nullableNumber(p.financialImpact?.currentValue),
          targetPrice: nullableNumber(p.financialImpact?.targetPrice),
          projectedPnL: nullableNumber(p.financialImpact?.projectedPnL),
          projectedValue: nullableNumber(p.financialImpact?.projectedValue),
          riskLevel: p.financialImpact?.riskLevel?.toUpperCase() ?? null,
          roi,
          percentChange: nullableNumber(p.financialImpact?.percentChange),
        },
        roiStatus: roi === null ? 'NOT_AVAILABLE' : 'AVAILABLE',
        title: p.title,
        summary: p.summary,
        reason: p.reason || [],
        sources: p.sources || [],
        confidence: confidence,
        sentimentType,
        expiresAt,
        createdAt: p.createdAt,
        quantScore: nullableNumber(p.quantScore),
        entryPrice: nullableNumber(p.entryPrice),
        exitPrice: nullableNumber(p.exitPrice),
        actualPnL: nullableNumber(p.actualPnL),
        winLossStatus: p.winLossStatus ?? null,
        backtestedAt: p.backtestedAt ?? null,
        livePerformance: livePerformanceById.get(p._id.toString()) ?? null,
        backtestMeta: p.backtestMeta ?? {},
        pnlPercentage: nullableNumber(p.pnlPercentage),
        lifecycleStatus,
        status: lifecycleStatus === 'EXPIRED' && !hasBacktestResult(p)
          ? 'expired'
          : p.status || p.executionStatus?.toLowerCase() || 'pending',
      };
    });

    return NextResponse.json(safeProposals);
  } catch (error) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch proposals';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
