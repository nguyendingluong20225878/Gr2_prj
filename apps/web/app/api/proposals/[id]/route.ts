import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import Proposal from '@/models/Proposal';
import { SignalModel } from '@/models/Signal';
import { PROPOSAL_TTL_MS } from '@/app/config/proposals';
import {
  deriveBacktestSemantics,
  deriveLayerConflict,
  deriveSignalHealth,
  extractRationaleBadges,
  normalizeAction,
  normalizeConfidence,
  normalizePercent,
  normalizeVolatility,
  type ScoreComponents,
} from '@/lib/utils/semantics';

export const dynamic = 'force-dynamic';

type LegacyFinancialImpact = {
  currentPrice?: number;
  currentValue?: number;
  projectedPnL?: number;
  projectedValue?: number;
  riskLevel?: string;
  roi?: number;
  roiPercent?: number;
  percentChange?: number;
  targetPrice?: number;
};

type ProposalDetailRecord = {
  _id: mongoose.Types.ObjectId;
  actualPnL?: number;
  action?: string;
  backtestMeta?: {
    dataQuality?: string;
    detectedAt?: Date;
    entryTimestamp?: Date;
    exitTimestamp?: Date;
    expiresAt?: Date;
    feeRate?: number;
    grossPnlPercentage?: number;
    notionalUsd?: number;
    slippageRate?: number;
  };
  backtestedAt?: Date;
  confidence?: number;
  createdAt?: Date;
  entryPrice?: number;
  executionStatus?: 'PENDING' | 'EXECUTED' | 'IGNORED';
  exitPrice?: number;
  expiresAt?: Date;
  financialImpact?: LegacyFinancialImpact;
  pnlPercentage?: number;
  quantScore?: number;
  scoreComponents?: ScoreComponents;
  volatilityFlag?: number;
  uncertaintyEntropy?: number;
  realizedVolatility?: number;
  signalMode?: 'COLD_START' | 'NORMALIZED_ALPHA';
  rationaleSummary?: string;
  reason?: string[];
  sentimentType?: string;
  signalId?: mongoose.Types.ObjectId | string;
  status?: string;
  summary?: string;
  suggestionType?: string;
  title?: string;
  tokenAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  triggerEventId?: string;
  triggerSignalId?: mongoose.Types.ObjectId;
  type?: string;
  updatedAt?: Date;
  winLossStatus?: string;
  sources?: Array<{ label: string; url: string }>;
};

type SignalFallbackRecord = {
  _id: mongoose.Types.ObjectId;
  confidence?: number;
  createdAt?: Date;
  detectedAt?: Date;
  expiresAt?: Date;
  metadata?: {
    isNewToken?: boolean;
    processedAt?: Date;
    sampleSize?: number;
    scoreComponents?: ScoreComponents;
    volatilityFlag?: number;
    uncertaintyEntropy?: number;
    realizedVolatility?: number;
  };
  quantScore?: number;
  rationaleSummary?: string;
  sentimentType?: string;
  sources?: Array<{ label?: string; url?: string }>;
  status?: string;
  suggestionType?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  volatilityFlag?: number;
  uncertaintyEntropy?: number;
  realizedVolatility?: number;
  signalMode?: 'COLD_START' | 'NORMALIZED_ALPHA';
  updatedAt?: Date;
};

const ProposalModel = Proposal as unknown as mongoose.Model<ProposalDetailRecord>;
const SIGNAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function resolveSignalDetectedAt(signal?: SignalFallbackRecord | null) {
  return signal?.detectedAt ?? signal?.createdAt ?? signal?.metadata?.processedAt ?? signal?.updatedAt ?? new Date();
}

function resolveSignalExpiresAt(signal?: SignalFallbackRecord | null) {
  const detectedAt = resolveSignalDetectedAt(signal);
  return signal?.expiresAt ?? new Date(detectedAt.getTime() + SIGNAL_TTL_MS);
}

function deriveProposalExpiresAt(createdAt?: Date) {
  return new Date((createdAt?.getTime() ?? Date.now()) + PROPOSAL_TTL_MS);
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function shortTokenKey(value?: string | null) {
  if (!value) return null;
  return value.length > 12 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();
    const { id } = params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    let p = await ProposalModel.findById(id).lean<ProposalDetailRecord | null>();
    
    if (!p) {
      p = await ProposalModel.findOne({ 
        $or: [
          { triggerEventId: id },
          { triggerSignalId: new mongoose.Types.ObjectId(id) },
          { signalId: id }
        ] 
      }).lean<ProposalDetailRecord | null>();
    }
    
    if (!p) {
      const signal = await SignalModel.findById(id).lean<SignalFallbackRecord | null>();
      if (signal) {
        const action = normalizeAction(signal.suggestionType);
        const health = deriveSignalHealth(signal);

        return NextResponse.json({
          _id: signal._id.toString(),
          signalId: signal._id.toString(),
          tokenSymbol: signal.tokenSymbol ?? shortTokenKey(signal.tokenAddress),
          tokenName: signal.tokenSymbol ?? shortTokenKey(signal.tokenAddress),
          action,
          financialImpact: {
            currentValue: null,
            projectedValue: null,
            riskLevel: null,
            roi: null,
            percentChange: null,
          },
          roiStatus: 'NOT_AVAILABLE',
          summary: signal.rationaleSummary,
          reason: signal.rationaleSummary ? [signal.rationaleSummary] : [],
          sources: signal.sources || [],
          confidence: normalizeConfidence(signal.confidence),
          expiresAt: resolveSignalExpiresAt(signal),
          createdAt: resolveSignalDetectedAt(signal),
          status: 'signal-only',
          sentimentType: signal.sentimentType ?? null,
          pnlPercentage: null,
          quantScore: nullableNumber(signal.quantScore ?? signal.metadata?.scoreComponents?.finalScore),
          semantics: {
            backtest: deriveBacktestSemantics({}),
            layerConflict: deriveLayerConflict(signal.suggestionType, signal.suggestionType),
            rationaleBadges: extractRationaleBadges(signal.rationaleSummary),
            signalHealth: health,
            volatility: normalizeVolatility(signal.volatilityFlag ?? signal.metadata?.volatilityFlag),
          },
          signalContext: {
            action,
            confidence: normalizeConfidence(signal.confidence),
            health,
            id: signal._id.toString(),
            quantScore: nullableNumber(signal.quantScore ?? signal.metadata?.scoreComponents?.finalScore),
            scoreComponents: signal.metadata?.scoreComponents,
            expiresAt: resolveSignalExpiresAt(signal),
            status: signal.status,
            suggestionType: signal.suggestionType,
            volatilityFlag: signal.volatilityFlag ?? signal.metadata?.volatilityFlag,
            uncertaintyEntropy: signal.uncertaintyEntropy ?? signal.metadata?.uncertaintyEntropy ?? signal.volatilityFlag ?? signal.metadata?.volatilityFlag,
            realizedVolatility: signal.realizedVolatility ?? signal.metadata?.realizedVolatility,
          },
        });
      }

      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    let finalAction = 'HOLD';
    if (p.type) finalAction = normalizeAction(p.type);
    else if (p.action) finalAction = normalizeAction(p.action);
    else if (p.suggestionType) finalAction = normalizeAction(p.suggestionType);
    else {
      const title = p.title?.toLowerCase() || '';
      if (title.includes('sell') || title.includes('close')) finalAction = 'SELL';
      else if (title.includes('buy') || title.includes('long')) finalAction = 'BUY';
    }

    const signalId = p.triggerSignalId || p.signalId;
    const linkedSignal = signalId && mongoose.Types.ObjectId.isValid(signalId.toString())
      ? await SignalModel.findById(signalId).lean<SignalFallbackRecord | null>()
      : null;

    const summary = p.summary || p.rationaleSummary || '';
    const rawRoi = nullableNumber(p.financialImpact?.roi);
    const roi = normalizePercent(rawRoi);
    const currentPrice = nullableNumber(p.financialImpact?.currentPrice);
    const currentValue = nullableNumber(p.financialImpact?.currentValue ?? p.financialImpact?.currentPrice);
    const targetPrice = nullableNumber(p.financialImpact?.targetPrice);
    const projectedValue = nullableNumber(p.financialImpact?.projectedValue);
    const signalAction = linkedSignal ? normalizeAction(linkedSignal.suggestionType) : normalizeAction(finalAction);
    const health = linkedSignal ? deriveSignalHealth(linkedSignal) : deriveSignalHealth({});

    const safeProposal = {
      _id: p._id.toString(),
      signalId: p.triggerEventId || p.triggerSignalId || p.signalId,
      tokenSymbol: p.tokenSymbol || null,
      tokenName: p.tokenName || p.title || null,
      action: finalAction,
      financialImpact: {
        currentPrice,
        currentValue,
        targetPrice,
        projectedValue,
        projectedPnL: nullableNumber(p.financialImpact?.projectedPnL),
        riskLevel: p.financialImpact?.riskLevel?.toUpperCase() ?? null,
        roi: roi, // ROI chuẩn
        percentChange: nullableNumber(p.financialImpact?.percentChange),
      },
      roiStatus: roi === null ? 'NOT_AVAILABLE' : 'AVAILABLE',
      actualPnL: p.actualPnL,
      backtestMeta: p.backtestMeta,
      backtestedAt: p.backtestedAt,
      entryPrice: p.entryPrice,
      exitPrice: p.exitPrice,
      pnlPercentage: nullableNumber(p.pnlPercentage),
      quantScore: nullableNumber(p.quantScore),
      scoreComponents: p.scoreComponents,
      volatilityFlag: p.volatilityFlag,
      uncertaintyEntropy: p.uncertaintyEntropy ?? linkedSignal?.uncertaintyEntropy ?? linkedSignal?.metadata?.uncertaintyEntropy,
      realizedVolatility: p.realizedVolatility ?? linkedSignal?.realizedVolatility ?? linkedSignal?.metadata?.realizedVolatility,
      signalMode: p.signalMode,
      summary,
      reason: p.reason || [],
      sources: p.sources || [],
      confidence: normalizeConfidence(p.confidence),
      expiresAt: p.expiresAt ?? deriveProposalExpiresAt(p.createdAt),
      createdAt: p.createdAt,
      status: p.status || p.executionStatus?.toLowerCase() || 'pending', // === FIX STATUS ===
      sentimentType: p.sentimentType ?? null,
      winLossStatus: p.winLossStatus,
      semantics: {
        backtest: deriveBacktestSemantics(p),
        layerConflict: deriveLayerConflict(signalAction, finalAction),
        rationaleBadges: extractRationaleBadges(summary),
        signalHealth: health,
        volatility: normalizeVolatility(linkedSignal?.realizedVolatility ?? linkedSignal?.metadata?.realizedVolatility ?? p.realizedVolatility ?? null),
      },
      signalContext: linkedSignal ? {
        action: signalAction,
        confidence: normalizeConfidence(linkedSignal.confidence),
        health,
        id: linkedSignal._id.toString(),
        quantScore: nullableNumber(linkedSignal.quantScore ?? linkedSignal.metadata?.scoreComponents?.finalScore),
        scoreComponents: linkedSignal.metadata?.scoreComponents ?? p.scoreComponents,
        expiresAt: resolveSignalExpiresAt(linkedSignal),
        status: linkedSignal.status,
        suggestionType: linkedSignal.suggestionType,
        volatilityFlag: linkedSignal.volatilityFlag ?? linkedSignal.metadata?.volatilityFlag ?? p.volatilityFlag,
        uncertaintyEntropy: linkedSignal.uncertaintyEntropy ?? linkedSignal.metadata?.uncertaintyEntropy ?? linkedSignal.volatilityFlag ?? linkedSignal.metadata?.volatilityFlag ?? p.uncertaintyEntropy,
        realizedVolatility: linkedSignal.realizedVolatility ?? linkedSignal.metadata?.realizedVolatility ?? p.realizedVolatility,
      } : {
        action: finalAction,
        confidence: normalizeConfidence(p.confidence),
        health,
        id: p.signalId?.toString() || p._id.toString(),
        quantScore: nullableNumber(p.quantScore),
        scoreComponents: p.scoreComponents,
        expiresAt: p.expiresAt ?? p.backtestMeta?.expiresAt,
        status: p.status,
        suggestionType: p.suggestionType,
        volatilityFlag: p.volatilityFlag,
        uncertaintyEntropy: p.uncertaintyEntropy,
        realizedVolatility: p.realizedVolatility,
      },
    };

    return NextResponse.json(safeProposal);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Proposal detail API Error:', message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
