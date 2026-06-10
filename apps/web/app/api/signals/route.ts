import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { SignalService } from '@/services/SignalService';
import Proposal from '@/models/Proposal';
import mongoose from 'mongoose';
import {
  deriveBacktestSemantics,
  deriveLayerConflict,
  extractRationaleBadges,
  normalizeAction,
  normalizeConfidence,
} from '@/lib/utils/semantics';

export const dynamic = 'force-dynamic';

const SIGNAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 200;
const CACHE_TTL_MS = 10_000;
const PROPOSAL_PROJECTION = {
  _id: 1,
  signalId: 1,
  actualPnL: 1,
  action: 1,
  backtestMeta: 1,
  backtestedAt: 1,
  confidence: 1,
  createdAt: 1,
  entryPrice: 1,
  executionStatus: 1,
  exitPrice: 1,
  pnlPercentage: 1,
  quantScore: 1,
  rationaleSummary: 1,
  realizedVolatility: 1,
  scoreComponents: 1,
  status: 1,
  suggestionType: 1,
  summary: 1,
  tokenSymbol: 1,
  uncertaintyEntropy: 1,
  volatilityFlag: 1,
  winLossStatus: 1,
};

type SignalsCacheEntry = {
  key: string;
  expiresAt: number;
  payload: any[];
};

let latestSignalsCache: SignalsCacheEntry | null = null;

function parseLimit(raw: string | null) {
  const value = raw ? Number(raw) : DEFAULT_LIMIT;
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(value), 1), MAX_LIMIT);
}

function parseCursor(raw: string | null): { detectedAt: Date; id?: string } | undefined {
  if (!raw) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    const detectedAt = new Date(decoded.detectedAt);
    if (!Number.isFinite(detectedAt.getTime())) return undefined;
    return { detectedAt, id: typeof decoded.id === 'string' ? decoded.id : undefined };
  } catch {
    const detectedAt = new Date(raw);
    return Number.isFinite(detectedAt.getTime()) ? { detectedAt } : undefined;
  }
}

function makeCursor(signal: any) {
  const detectedAt = new Date(resolveSignalDetectedAt(signal));
  if (!Number.isFinite(detectedAt.getTime())) return null;
  return Buffer.from(
    JSON.stringify({
      detectedAt: detectedAt.toISOString(),
      id: signal._id?.toString(),
    })
  ).toString('base64url');
}

function resolveSignalDetectedAt(signal: any) {
  return signal.detectedAt ?? signal.createdAt ?? signal.metadata?.processedAt ?? signal.updatedAt ?? new Date();
}

function resolveSignalExpiresAt(signal: any, detectedAt: Date) {
  return signal.expiresAt ?? new Date(detectedAt.getTime() + SIGNAL_TTL_MS);
}

export async function GET(request: Request) {
  try {
    const requestStartedAt = Date.now();
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = parseLimit(limitParam);
    const type = searchParams.get('type') || 'ALL';
    const cursor = parseCursor(searchParams.get('cursor'));
    const includeMeta = searchParams.get('meta') === '1';
    const cacheKey = JSON.stringify({ limit, type, cursor: searchParams.get('cursor') ?? null, includeMeta });

    if (!cursor && latestSignalsCache?.key === cacheKey && latestSignalsCache.expiresAt > Date.now()) {
      return NextResponse.json(
        includeMeta
          ? {
              data: latestSignalsCache.payload,
              nextCursor: latestSignalsCache.payload.length
                ? makeCursor(latestSignalsCache.payload[latestSignalsCache.payload.length - 1])
                : null,
              cache: 'HIT',
            }
          : latestSignalsCache.payload,
        {
          headers: {
            'Cache-Control': 'no-store',
            'X-Signals-Cache': 'HIT',
          },
        }
      );
    }
    
    await connectDB();

    const signals = await SignalService.getSignals(limit, type, cursor);
    const signalIds: string[] = signals.reduce((ids: string[], signal: any) => {
      const id = signal._id?.toString();
      if (id && mongoose.Types.ObjectId.isValid(id)) ids.push(id);
      return ids;
    }, []);

    const proposals = signalIds.length
      ? await (Proposal as mongoose.Model<any>).aggregate([
          { $match: { signalId: { $in: signalIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
          { $sort: { signalId: 1, createdAt: -1, _id: -1 } },
          { $group: { _id: '$signalId', proposal: { $first: '$$ROOT' } } },
          { $replaceRoot: { newRoot: '$proposal' } },
          { $project: PROPOSAL_PROJECTION },
        ])
      : [];

    const proposalBySignalId = new Map<string, any>();
    proposals.forEach((proposal: any) => {
      const signalId = proposal.signalId?.toString();
      if (signalId && !proposalBySignalId.has(signalId)) {
        proposalBySignalId.set(signalId, proposal);
      }
    });

    const enrichedSignals = signals.map((signal: any) => {
      const detectedAt = new Date(resolveSignalDetectedAt(signal));
      const expiresAt = resolveSignalExpiresAt(signal, detectedAt);
      const normalizedSignal = {
        ...signal,
        detectedAt,
        expiresAt,
        volatilityFlag: signal.volatilityFlag ?? signal.metadata?.volatilityFlag ?? null,
        uncertaintyEntropy: signal.uncertaintyEntropy ?? signal.metadata?.uncertaintyEntropy ?? signal.volatilityFlag ?? signal.metadata?.volatilityFlag ?? null,
        realizedVolatility: signal.realizedVolatility ?? signal.metadata?.realizedVolatility ?? null,
        lifecycleState: signal.enrichedProposal
          ? 'EXPLAINED'
          : signal.status === 'PROCESSED'
            ? 'EXPLANATION_PENDING'
            : 'QUANT_READY',
        confidenceBreakdown: buildConfidenceBreakdown(signal),
      };
      const proposal = proposalBySignalId.get(signal._id?.toString());
      if (!proposal) return normalizedSignal;

      const layer2Action = normalizeAction(signal.suggestionType);
      const layer3Action = normalizeAction(proposal.suggestionType || proposal.action);
      const summary = proposal.rationaleSummary || proposal.summary || signal.rationaleSummary;
      const backtest = deriveBacktestSemantics(proposal);

      return {
        ...normalizedSignal,
        lifecycleState: backtest.outcome !== 'NOT_TESTED' ? 'BACKTESTED' : 'EXPLAINED',
        enrichedProposal: {
          _id: proposal._id?.toString(),
          action: layer3Action,
          backtest,
          confidence: normalizeConfidence(proposal.confidence),
          executionStatus: proposal.executionStatus,
          layerConflict: deriveLayerConflict(layer2Action, layer3Action),
          pnlPercentage: proposal.pnlPercentage,
          quantScore: proposal.quantScore,
          scoreComponents: proposal.scoreComponents,
          volatilityFlag: proposal.volatilityFlag,
          uncertaintyEntropy: proposal.uncertaintyEntropy,
          realizedVolatility: proposal.realizedVolatility,
          rationaleBadges: extractRationaleBadges(summary),
          rationaleSummary: summary,
          status: proposal.status,
          suggestionType: proposal.suggestionType,
          tokenSymbol: proposal.tokenSymbol,
          winLossStatus: proposal.winLossStatus,
        },
      };
    });

    const payload = includeMeta
      ? {
          data: enrichedSignals,
          nextCursor: enrichedSignals.length
            ? makeCursor(enrichedSignals[enrichedSignals.length - 1])
            : null,
          cache: 'MISS',
          latencyMs: Date.now() - requestStartedAt,
        }
      : enrichedSignals;

    if (!cursor) {
      latestSignalsCache = {
        key: cacheKey,
        expiresAt: Date.now() + CACHE_TTL_MS,
        payload: enrichedSignals,
      };
    }

    console.log(
      `[API /signals] latency=${Date.now() - requestStartedAt}ms limit=${limit} type=${type} cursor=${cursor ? 'yes' : 'no'} count=${enrichedSignals.length}`
    );

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Signals-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: 'Failed to fetch signals', details: String(error) }, 
      { status: 500 }
    );
  }
}

function buildConfidenceBreakdown(signal: any) {
  const components = signal.metadata?.scoreComponents ?? {};
  const sampleSize = Number(signal.metadata?.sampleSize ?? signal.sources?.length ?? 0);
  const entropy = signal.uncertaintyEntropy ?? signal.metadata?.uncertaintyEntropy;
  const finalScore = Number(signal.quantScore ?? components.finalScore ?? 0);
  const breakdown = [];

  if (Number.isFinite(finalScore) && Math.abs(finalScore) >= 1.5) {
    breakdown.push({
      label: finalScore > 0
        ? 'Tín hiệu tăng đủ mạnh so với dữ liệu so sánh'
        : 'Tín hiệu giảm đủ mạnh so với dữ liệu so sánh',
      impact: 'positive',
    });
  }

  if (Number.isFinite(components.timeZ)) {
    breakdown.push({
      label: Math.abs(Number(components.timeZ)) >= 1
        ? 'Tín hiệu nổi bật so với bối cảnh thời gian gần đây'
        : 'Tín hiệu chưa nổi bật rõ theo bối cảnh thời gian',
      impact: Math.abs(Number(components.timeZ)) >= 1 ? 'positive' : 'neutral',
    });
  }

  if (Number.isFinite(sampleSize)) {
    breakdown.push({
      label: sampleSize >= 3
        ? 'Có nhiều nguồn dữ liệu cùng hỗ trợ tín hiệu'
        : 'Nguồn dữ liệu còn mỏng nên cần đọc thận trọng',
      impact: sampleSize >= 3 ? 'positive' : 'negative',
    });
  }

  if (Number.isFinite(entropy)) {
    breakdown.push({
      label: Number(entropy) > 0.82
        ? 'Mức đồng thuận giữa các nguồn còn thấp'
        : 'Mức đồng thuận giữa các nguồn chưa phát hiện bất thường lớn',
      impact: Number(entropy) > 0.82 ? 'negative' : 'neutral',
    });
  }

  if (signal.metadata?.signalMode === 'COLD_START') {
    breakdown.push({
      label: 'Token còn ít lịch sử nên confidence bị giới hạn thận trọng',
      impact: 'negative',
    });
  }

  return breakdown;
}
