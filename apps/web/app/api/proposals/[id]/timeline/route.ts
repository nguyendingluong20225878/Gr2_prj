import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Proposal from '@/models/Proposal';
import { backtestResultsTable, resolveToken, tokenPriceHistory } from '@gr2/shared';
import { normalizeAction, normalizeConfidence, normalizePercent } from '@/lib/utils/semantics';

export const dynamic = 'force-dynamic';

type AnyRecord = Record<string, any>;

const ProposalModel = Proposal as unknown as mongoose.Model<AnyRecord>;
const PriceHistoryModel = tokenPriceHistory as unknown as mongoose.Model<AnyRecord>;
const BacktestModel = backtestResultsTable as unknown as mongoose.Model<AnyRecord>;

function numeric(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function markerResult(proposal: AnyRecord, backtest?: AnyRecord | null) {
  const raw = String(proposal.winLossStatus ?? backtest?.winLossStatus ?? '').toUpperCase();
  if (raw === 'WIN') return 'Win';
  if (raw === 'LOSS') return 'Loss';
  if (raw === 'BREAKEVEN') return 'Breakeven';
  return 'Pending';
}

type PricePoint = {
  timestamp: Date;
  price: number;
  source: string | undefined;
};

type PriceCoverage = {
  startAt: string | null;
  endAt: string | null;
  pointCount: number;
  medianGapMs: number | null;
  maxAllowedMarkerGapMs: number | null;
};

function buildPriceCoverage(pricePoints: PricePoint[]): PriceCoverage {
  if (!pricePoints.length) {
    return {
      startAt: null,
      endAt: null,
      pointCount: 0,
      medianGapMs: null,
      maxAllowedMarkerGapMs: null,
    };
  }

  const times = pricePoints
    .map((point) => point.timestamp.getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);
  const gaps = times
    .slice(1)
    .map((time, index) => time - times[index])
    .filter((gap) => gap > 0)
    .sort((a, b) => a - b);
  const medianGapMs = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
  const maxAllowedMarkerGapMs = medianGapMs === null
    ? 60 * 60 * 1000
    : Math.max(medianGapMs * 2.5, 60 * 60 * 1000);

  return {
    startAt: new Date(times[0]).toISOString(),
    endAt: new Date(times[times.length - 1]).toISOString(),
    pointCount: times.length,
    medianGapMs,
    maxAllowedMarkerGapMs,
  };
}

function nearestPricePoint(time: number, pricePoints: PricePoint[]) {
  if (!pricePoints.length) return null;
  return pricePoints.reduce((best, point) => (
    Math.abs(point.timestamp.getTime() - time) < Math.abs(best.timestamp.getTime() - time) ? point : best
  ), pricePoints[0]);
}

function resolveMarkerPrice(markerDate: Date | null, pricePoints: PricePoint[], coverage: PriceCoverage) {
  if (!pricePoints.length || !coverage.startAt || !coverage.endAt) {
    return {
      priceStatus: 'NO_PRICE_HISTORY' as const,
      markerPrice: null,
      matchedPriceAt: null,
      priceGapMs: null,
    };
  }

  if (!markerDate) {
    return {
      priceStatus: 'OUT_OF_RANGE' as const,
      markerPrice: null,
      matchedPriceAt: null,
      priceGapMs: null,
    };
  }

  const markerTime = markerDate.getTime();
  const startTime = new Date(coverage.startAt).getTime();
  const endTime = new Date(coverage.endAt).getTime();
  if (markerTime < startTime || markerTime > endTime) {
    return {
      priceStatus: 'OUT_OF_RANGE' as const,
      markerPrice: null,
      matchedPriceAt: null,
      priceGapMs: null,
    };
  }

  const nearest = nearestPricePoint(markerTime, pricePoints);
  if (!nearest) {
    return {
      priceStatus: 'NO_PRICE_HISTORY' as const,
      markerPrice: null,
      matchedPriceAt: null,
      priceGapMs: null,
    };
  }

  const priceGapMs = Math.abs(nearest.timestamp.getTime() - markerTime);
  if (coverage.maxAllowedMarkerGapMs !== null && priceGapMs > coverage.maxAllowedMarkerGapMs) {
    return {
      priceStatus: 'PRICE_GAP_TOO_LARGE' as const,
      markerPrice: null,
      matchedPriceAt: nearest.timestamp.toISOString(),
      priceGapMs,
    };
  }

  return {
    priceStatus: 'MATCHED' as const,
    markerPrice: nearest.price,
    matchedPriceAt: nearest.timestamp.toISOString(),
    priceGapMs,
  };
}

function markerFromProposal(proposal: AnyRecord, currentId: string, backtest: AnyRecord | null | undefined, pricePoints: PricePoint[], coverage: PriceCoverage) {
  const result = markerResult(proposal, backtest);
  const markerDateValue = proposal.createdAt ?? proposal.backtestMeta?.detectedAt ?? backtest?.detectedAt ?? null;
  const markerDate = markerDateValue ? new Date(markerDateValue) : null;
  const markerPrice = resolveMarkerPrice(markerDate && Number.isFinite(markerDate.getTime()) ? markerDate : null, pricePoints, coverage);
  return {
    id: proposal._id.toString(),
    date: markerDateValue,
    action: normalizeAction(proposal.action ?? proposal.suggestionType ?? proposal.type),
    confidence: normalizeConfidence(proposal.confidence),
    quant: numeric(proposal.quantScore ?? proposal.scoreComponents?.finalScore),
    result,
    pnlPercentage: normalizePercent(proposal.pnlPercentage ?? backtest?.pnlPercentage),
    entryPrice: numeric(proposal.entryPrice ?? backtest?.entryPrice),
    exitPrice: numeric(proposal.exitPrice ?? backtest?.exitPrice),
    expirationTime: proposal.expiresAt ?? proposal.backtestMeta?.expiresAt ?? backtest?.expiresAt ?? null,
    isCurrent: proposal._id.toString() === currentId,
    ...markerPrice,
  };
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean))];
}

function buildPriceQuery(tokenIds: mongoose.Types.ObjectId[], tokenAddressKeys: string[], start?: Date, end?: Date) {
  const orFilters: AnyRecord[] = [];
  if (tokenAddressKeys.length) orFilters.push({ tokenAddress: { $in: tokenAddressKeys } });
  if (tokenIds.length) orFilters.push({ token: { $in: tokenIds } });

  const query: AnyRecord = orFilters.length ? { $or: orFilters } : {};
  if (start && end) query.timestamp = { $gte: start, $lte: end };
  return query;
}

function markerDateFromProposal(proposal: AnyRecord, backtest?: AnyRecord | null) {
  const value = proposal.createdAt ?? proposal.backtestMeta?.detectedAt ?? backtest?.detectedAt ?? null;
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function buildTimelineWindow(currentCreatedAt: Date, proposals: AnyRecord[], backtestByProposalId: Map<string, AnyRecord>) {
  const markerTimes = proposals
    .map((item) => markerDateFromProposal(item, backtestByProposalId.get(item._id.toString()))?.getTime())
    .filter((time): time is number => Number.isFinite(time));
  const oneDay = 24 * 60 * 60 * 1000;
  const baseStart = currentCreatedAt.getTime() - 180 * oneDay;
  const baseEnd = Math.max(Date.now(), currentCreatedAt.getTime() + 7 * oneDay);
  const markerStart = markerTimes.length ? Math.min(...markerTimes) - 7 * oneDay : baseStart;
  const markerEnd = markerTimes.length ? Math.max(...markerTimes) + 7 * oneDay : baseEnd;

  return {
    start: new Date(Math.min(baseStart, markerStart)),
    end: new Date(Math.max(baseEnd, markerEnd)),
  };
}

function samplePriceHistory(points: PricePoint[], maxPoints = 500) {
  if (points.length <= maxPoints) return points;
  const sampled: PricePoint[] = [];
  const step = (points.length - 1) / (maxPoints - 1);

  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(points[Math.round(index * step)]);
  }

  return sampled;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const proposal = await ProposalModel.findById(params.id).lean<AnyRecord | null>();
    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const tokenAddress = proposal.tokenAddress ?? null;
    const tokenSymbol = proposal.tokenSymbol ?? null;
    const resolvedToken = await resolveToken({
      chain: 'solana',
      addressOrMint: tokenAddress,
      symbol: tokenSymbol,
    });
    const resolvedTokenId = resolvedToken?._id && mongoose.Types.ObjectId.isValid(String(resolvedToken._id))
      ? new mongoose.Types.ObjectId(String(resolvedToken._id))
      : null;
    const tokenAddressKeys = uniqueStrings([
      tokenAddress,
      tokenSymbol,
      resolvedToken?.address,
      resolvedToken?.primaryAddress,
      resolvedToken?.canonicalKey,
      resolvedToken?.coingeckoId,
      ...(resolvedToken?.aliases ?? []).map((alias: AnyRecord) => alias.value),
    ]);
    const tokenIds = resolvedTokenId ? [resolvedTokenId] : [];
    const createdAt = proposal.createdAt ? new Date(proposal.createdAt) : new Date();
    const missingData: string[] = [];

    const proposalFilters: AnyRecord[] = [];
    if (tokenAddress) proposalFilters.push({ tokenAddress });
    if (tokenSymbol) proposalFilters.push({ tokenSymbol });
    const proposalQuery: AnyRecord = proposalFilters.length ? { $or: proposalFilters } : { _id: proposal._id };

    const [historicalProposals, backtests] = await Promise.all([
      ProposalModel.find(proposalQuery)
        .sort({ createdAt: 1 })
        .limit(80)
        .lean<AnyRecord[]>(),
      BacktestModel.find(proposalQuery)
        .sort({ detectedAt: 1 })
        .limit(80)
        .lean<AnyRecord[]>(),
    ]);
    const backtestByProposalId = new Map(backtests.map((row) => [String(row.proposalId), row]));
    const timelineWindow = buildTimelineWindow(createdAt, historicalProposals.length ? historicalProposals : [proposal], backtestByProposalId);
    const priceRows = tokenAddressKeys.length || tokenIds.length
      ? await PriceHistoryModel.find(buildPriceQuery(tokenIds, tokenAddressKeys, timelineWindow.start, timelineWindow.end))
        .sort({ timestamp: 1 })
        .lean<AnyRecord[]>()
      : [];

    if (!tokenAddress && !resolvedToken) missingData.push('tokenAddress');
    const pricePoints = priceRows
      .map((row): PricePoint | null => {
        const timestamp = row.timestamp ? new Date(row.timestamp) : null;
        const price = numeric(row.priceUsd);
        return timestamp && Number.isFinite(timestamp.getTime()) && price !== null
          ? { timestamp, price, source: row.source }
          : null;
      })
      .filter((point): point is PricePoint => Boolean(point));
    const priceCoverage = buildPriceCoverage(pricePoints);

    if (!pricePoints.length) missingData.push('priceHistory');
    if (!historicalProposals.some((item) => item._id.toString() !== params.id)) missingData.push('historicalProposals');
    if (!backtests.length && (proposal.pnlPercentage === null || proposal.pnlPercentage === undefined)) missingData.push('backtestResults');

    const currentBacktest = backtestByProposalId.get(params.id) ?? null;
    const markers = historicalProposals.map((item) => markerFromProposal(item, params.id, backtestByProposalId.get(item._id.toString()), pricePoints, priceCoverage));
    const chartPricePoints = samplePriceHistory(pricePoints);

    return NextResponse.json({
      token: {
        symbol: tokenSymbol,
        address: tokenAddress ?? resolvedToken?.primaryAddress ?? resolvedToken?.address ?? null,
      },
      priceCoverage,
      priceHistory: chartPricePoints.map((row) => ({
        timestamp: row.timestamp,
        price: row.price,
        source: row.source,
      })),
      currentProposal: markerFromProposal(proposal, params.id, currentBacktest, pricePoints, priceCoverage),
      historicalProposals: markers.filter((marker) => !marker.isCurrent),
      backtestResults: markers.map((marker) => ({
        proposalId: marker.id,
        result: marker.result,
        pnlPercentage: marker.pnlPercentage,
        entryPrice: marker.entryPrice,
        exitPrice: marker.exitPrice,
        expirationTime: marker.expirationTime,
      })),
      missingData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Proposal timeline API Error:', message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
