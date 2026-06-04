import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Proposal from '@/models/Proposal';
import { SignalModel } from '@/models/Signal';
import { normalizeAction, normalizeConfidence } from '@/lib/utils/semantics';

export const dynamic = 'force-dynamic';

type AnyRecord = Record<string, any>;

const ProposalModel = Proposal as unknown as mongoose.Model<AnyRecord>;
const DEFAULTS = {
  actionThreshold: 1,
  coldStartActionThreshold: 999,
  confidenceDivisor: 3,
  coldStartConfidenceDivisor: 5,
  signalThreshold: 1,
};

function numeric(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function samplePenalty(sampleSize?: number | null) {
  if (!Number.isFinite(sampleSize)) return null;
  if (Number(sampleSize) <= 3) return 0.75;
  if (Number(sampleSize) <= 5) return 0.9;
  return 1;
}

function confidenceCap(mode?: string | null) {
  return mode === 'COLD_START' ? 0.4 : 0.95;
}

async function loadProposalAndSignal(id: string) {
  let proposal = await ProposalModel.findById(id).lean<AnyRecord | null>();

  if (!proposal) {
    const fallbackFilters: AnyRecord[] = [{ triggerEventId: id }, { signalId: id }];
    if (mongoose.Types.ObjectId.isValid(id)) {
      fallbackFilters.push({ triggerSignalId: new mongoose.Types.ObjectId(id) });
    }

    proposal = await ProposalModel.findOne({
      $or: fallbackFilters,
    }).lean<AnyRecord | null>();
  }

  const signalId = proposal?.triggerSignalId ?? proposal?.signalId;
  const signal = signalId && mongoose.Types.ObjectId.isValid(String(signalId))
    ? await SignalModel.findById(signalId).lean<AnyRecord | null>()
    : mongoose.Types.ObjectId.isValid(id)
      ? await SignalModel.findById(id).lean<AnyRecord | null>()
      : null;

  return { proposal, signal };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const { proposal, signal } = await loadProposalAndSignal(params.id);
    if (!proposal && !signal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const metadata = signal?.metadata ?? {};
    const scoreComponents = proposal?.scoreComponents ?? metadata.scoreComponents ?? {};
    const hyperParams = metadata.hyperParams ?? scoreComponents.hyperParams ?? {};
    const signalMode = proposal?.signalMode ?? metadata.signalMode ?? (metadata.isNewToken ? 'COLD_START' : 'NORMALIZED_ALPHA');
    const sampleSize = numeric(metadata.sampleSize ?? scoreComponents.sampleSize);
    const finalScore = numeric(proposal?.quantScore ?? signal?.quantScore ?? scoreComponents.finalScore);
    const action = normalizeAction(proposal?.action ?? proposal?.suggestionType ?? signal?.suggestionType);
    const confidence = normalizeConfidence(proposal?.confidence ?? signal?.confidence);
    const thresholds = {
      actionThreshold: numeric(hyperParams.actionThreshold) ?? DEFAULTS.actionThreshold,
      coldStartActionThreshold: numeric(hyperParams.coldStartActionThreshold) ?? DEFAULTS.coldStartActionThreshold,
      confidenceDivisor: numeric(hyperParams.confidenceDivisor) ?? DEFAULTS.confidenceDivisor,
      coldStartConfidenceDivisor: numeric(hyperParams.coldStartConfidenceDivisor) ?? DEFAULTS.coldStartConfidenceDivisor,
      signalThreshold: numeric(hyperParams.signalThreshold) ?? DEFAULTS.signalThreshold,
    };
    const penalty = samplePenalty(sampleSize);
    const cap = confidenceCap(signalMode);
    const absScore = Math.abs(finalScore ?? 0);

    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];
    const missingData: string[] = [];

    if (finalScore !== null && absScore > thresholds.signalThreshold) {
      positiveFactors.push('finalScore vượt ngưỡng phát hiện tín hiệu.');
    }
    if (finalScore !== null && action === 'BUY' && finalScore > 0) {
      positiveFactors.push('Điểm quant dương tạo thiên hướng BUY.');
    }
    if (finalScore !== null && action === 'SELL' && finalScore < 0) {
      positiveFactors.push('Điểm quant âm tạo thiên hướng SELL.');
    }
    if (signalMode === 'NORMALIZED_ALPHA') {
      positiveFactors.push('NORMALIZED_ALPHA: có đủ lịch sử để so sánh với mẫu quá khứ và tương quan thị trường.');
    }
    if (proposal?.sources?.length || signal?.sources?.length) {
      positiveFactors.push('Có nguồn dữ liệu được gắn với đề xuất.');
    }
    if (proposal?.pnlPercentage !== null && proposal?.pnlPercentage !== undefined) {
      positiveFactors.push('Đã có kết quả backtest/PnL cho đề xuất này.');
    }

    if (signalMode === 'COLD_START') {
      negativeFactors.push('COLD_START: thiếu lịch sử, confidence bị cap tối đa 40%.');
    }
    if (penalty !== null && penalty < 1) {
      negativeFactors.push(`Sample size thấp nên confidence bị nhân penalty ${penalty}.`);
    }
    if (!proposal?.sources?.length && !signal?.sources?.length) {
      negativeFactors.push('Thiếu nguồn dữ liệu gắn với đề xuất.');
      missingData.push('sources');
    }
    if (finalScore === null) missingData.push('finalScore');
    if (sampleSize === null) missingData.push('sampleSize');
    if (proposal?.pnlPercentage === null || proposal?.pnlPercentage === undefined) missingData.push('backtest');
    if (!proposal?.financialImpact?.currentPrice && !proposal?.financialImpact?.currentValue) missingData.push('price');

    return NextResponse.json({
      confidenceFormula: signalMode === 'COLD_START'
        ? 'confidence = min(abs(finalScore) / coldStartConfidenceDivisor, 0.4)'
        : 'confidence = min(abs(finalScore) / confidenceDivisor, 0.95) * sampleSizePenalty',
      quantFormula: 'finalScore = alphaBlend * pureAlphaZ + (1 - alphaBlend) * crossZ; cold-start/BTC fallback dùng pureAlphaZ',
      signalMode,
      sampleSize,
      thresholds,
      scoreComponents,
      finalScore,
      confidence,
      confidenceCap: cap,
      sampleSizePenalty: penalty,
      positiveFactors,
      negativeFactors,
      missingData,
      auditTrail: [
        {
          step: 'Data ingestion',
          detail: proposal?.sources?.length || signal?.sources?.length ? 'Nguồn tin/social/price đã được gắn với signal.' : 'Chưa có nguồn hiển thị.',
          status: proposal?.sources?.length || signal?.sources?.length ? 'OK' : 'MISSING',
        },
        {
          step: 'Signal detection',
          detail: finalScore === null ? 'Thiếu finalScore.' : `finalScore=${finalScore.toFixed(3)}, abs=${absScore.toFixed(3)}.`,
          status: finalScore === null ? 'MISSING' : 'OK',
        },
        {
          step: 'Proposal generation',
          detail: `Action được normalize thành ${action}.`,
          status: 'OK',
        },
        {
          step: 'Backtest evaluation',
          detail: proposal?.pnlPercentage === null || proposal?.pnlPercentage === undefined ? 'Chưa có PnL/backtest.' : 'Đã có PnL/backtest.',
          status: proposal?.pnlPercentage === null || proposal?.pnlPercentage === undefined ? 'MISSING' : 'OK',
        },
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Score explanation API Error:', message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
