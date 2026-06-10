import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import Proposal from '@/models/Proposal';

export const dynamic = 'force-dynamic';

type TradeDirection = 'LONG' | 'SHORT';
type PreviewStatus = 'OK' | 'LIMITED';

type TradePreviewRequest = {
  proposalId?: string;
  amountUsd?: number | string;
  leverage?: number | string;
  entryPrice?: number | string | null;
  direction?: TradeDirection;
};

type ProposalTradePreviewRecord = {
  _id: mongoose.Types.ObjectId;
  action?: string;
  backtestMeta?: {
    feeRate?: number | string | null;
    slippageRate?: number | string | null;
  };
  entryPrice?: number | string | null;
  financialImpact?: {
    currentPrice?: number | string | null;
    currentValue?: number | string | null;
    riskLevel?: string | null;
    stopLoss?: number | string | null;
  };
  suggestionType?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
};

const ProposalModel = Proposal as unknown as mongoose.Model<ProposalTradePreviewRecord>;
const MAX_LEVERAGE = 10;
const DEFAULT_STOP_LOSS_BY_RISK: Record<string, number> = {
  LOW: 3,
  MEDIUM: 5,
  HIGH: 8,
};

function parsePositiveNumber(value: unknown, fieldName: string) {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }

  return parsed;
}

function nullablePositiveNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nullableNonNegativeNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function roundMoney(value: number | null) {
  return value === null ? null : Number(value.toFixed(2));
}

function roundPct(value: number | null) {
  return value === null ? null : Number(value.toFixed(4));
}

function resolveDirection(input: unknown, proposal: ProposalTradePreviewRecord): TradeDirection {
  if (input === 'LONG' || input === 'SHORT') return input;
  if (input !== undefined && input !== null) {
    throw new Error('direction must be LONG or SHORT');
  }

  const action = String(proposal.action ?? proposal.suggestionType ?? '').toUpperCase();
  return action === 'SELL' || action === 'SHORT' ? 'SHORT' : 'LONG';
}

function resolveStopLossPct(proposal: ProposalTradePreviewRecord, entryPrice: number | null) {
  const stopLossPrice = nullablePositiveNumber(proposal.financialImpact?.stopLoss);
  if (stopLossPrice !== null && entryPrice !== null) {
    return Math.abs((entryPrice - stopLossPrice) / entryPrice) * 100;
  }

  const riskLevel = proposal.financialImpact?.riskLevel?.toUpperCase();
  return riskLevel ? DEFAULT_STOP_LOSS_BY_RISK[riskLevel] ?? null : null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TradePreviewRequest;
    const { proposalId } = body;

    if (!proposalId || !mongoose.Types.ObjectId.isValid(proposalId)) {
      return NextResponse.json({ error: 'proposalId is invalid' }, { status: 400 });
    }

    const amountUsd = parsePositiveNumber(body.amountUsd, 'amountUsd');
    const leverage = parsePositiveNumber(body.leverage, 'leverage');

    if (!Number.isInteger(leverage) || leverage > MAX_LEVERAGE) {
      return NextResponse.json({ error: `leverage must be an integer from 1 to ${MAX_LEVERAGE}` }, { status: 400 });
    }

    const requestedEntryPrice = body.entryPrice === null || body.entryPrice === undefined
      ? null
      : parsePositiveNumber(body.entryPrice, 'entryPrice');

    await connectDB();

    const proposal = await ProposalModel.findById(proposalId).lean<ProposalTradePreviewRecord | null>();
    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const entryPrice =
      requestedEntryPrice ??
      nullablePositiveNumber(proposal.entryPrice) ??
      nullablePositiveNumber(proposal.financialImpact?.currentPrice);
    const direction = resolveDirection(body.direction, proposal);
    const notionalUsd = amountUsd * leverage;
    const stopLossPct = resolveStopLossPct(proposal, entryPrice);
    const riskPerTradePct = stopLossPct === null ? null : stopLossPct * leverage;
    const maxLossUsd = riskPerTradePct === null ? null : amountUsd * (riskPerTradePct / 100);
    const feeRate = nullableNonNegativeNumber(proposal.backtestMeta?.feeRate);
    const slippageRate = nullableNonNegativeNumber(proposal.backtestMeta?.slippageRate);
    const estimatedFeeUsd = feeRate === null ? null : notionalUsd * feeRate;
    const estimatedSlippageUsd = slippageRate === null ? null : notionalUsd * slippageRate;
    const warnings: string[] = [];

    if (entryPrice === null) warnings.push('Chưa có giá token');
    if (stopLossPct === null) warnings.push('Chưa có dữ liệu stop loss');
    if (feeRate === null) warnings.push('Chưa có dữ liệu fee');
    if (slippageRate === null) warnings.push('Chưa có dữ liệu slippage');

    const status: PreviewStatus = warnings.length > 0 ? 'LIMITED' : 'OK';

    return NextResponse.json({
      status,
      warning: warnings[0] ?? null,
      warnings,
      proposalId: proposal._id.toString(),
      tokenSymbol: proposal.tokenSymbol ?? null,
      tokenAddress: proposal.tokenAddress ?? null,
      direction,
      entryPrice,
      amountUsd: roundMoney(amountUsd),
      leverage,
      notionalUsd: roundMoney(notionalUsd),
      recommendedSizeUsd: roundMoney(amountUsd),
      maxLossUsd: roundMoney(maxLossUsd),
      riskPerTradePct: roundPct(riskPerTradePct),
      stopLossPct: roundPct(stopLossPct),
      estimatedFeeUsd: roundMoney(estimatedFeeUsd),
      estimatedSlippageUsd: roundMoney(estimatedSlippageUsd),
      assumptions: {
        feeRate,
        slippageRate,
        stopLossSource: stopLossPct === null
          ? null
          : nullablePositiveNumber(proposal.financialImpact?.stopLoss) !== null
            ? 'proposal.financialImpact.stopLoss'
            : 'proposal.financialImpact.riskLevel',
      },
    });
  } catch (error) {
    console.error('Trade Preview Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    const status = message.includes('invalid') || message.includes('must be') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
