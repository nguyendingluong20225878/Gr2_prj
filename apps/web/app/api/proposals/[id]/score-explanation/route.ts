import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Proposal from '@/models/Proposal';
import { SignalModel } from '@/models/Signal';
import { normalizeAction, normalizeConfidence } from '@/lib/utils/semantics';

export const dynamic = 'force-dynamic';

type AnyRecord = Record<string, any>;
type ExplanationStatus = 'OK' | 'MISSING' | 'LIMITED';

const ProposalModel = Proposal as unknown as mongoose.Model<AnyRecord>;
const DEFAULTS = {
  actionThreshold: 1,
  alphaBlend: 0.7,
  coldStartActionThreshold: 999,
  confidenceDivisor: 3,
  coldStartConfidenceDivisor: 5,
  signalThreshold: 1,
};

function numeric(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasOwnValue(record: AnyRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key) && record[key] !== null && record[key] !== undefined;
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

function hasItems(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined;
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
    const alphaBlendFromModel = hasOwnValue(hyperParams, 'alphaBlend') ? numeric(hyperParams.alphaBlend) : null;
    const signalMode = proposal?.signalMode ?? metadata.signalMode ?? (metadata.isNewToken ? 'COLD_START' : 'NORMALIZED_ALPHA');
    const sampleSize = numeric(metadata.sampleSize ?? scoreComponents.sampleSize);
    const finalScore = numeric(proposal?.quantScore ?? signal?.quantScore ?? scoreComponents.finalScore);
    const action = normalizeAction(proposal?.action ?? proposal?.suggestionType ?? signal?.suggestionType);
    const confidence = normalizeConfidence(proposal?.confidence ?? signal?.confidence);
    const thresholds = {
      actionThreshold: numeric(hyperParams.actionThreshold) ?? DEFAULTS.actionThreshold,
      alphaBlend: alphaBlendFromModel,
      coldStartActionThreshold: numeric(hyperParams.coldStartActionThreshold) ?? DEFAULTS.coldStartActionThreshold,
      confidenceDivisor: numeric(hyperParams.confidenceDivisor) ?? DEFAULTS.confidenceDivisor,
      coldStartConfidenceDivisor: numeric(hyperParams.coldStartConfidenceDivisor) ?? DEFAULTS.coldStartConfidenceDivisor,
      signalThreshold: numeric(hyperParams.signalThreshold) ?? DEFAULTS.signalThreshold,
    };
    const quantFormulaMode = signalMode === 'COLD_START' || !hasValue(scoreComponents.crossZ)
      ? 'PURE_ALPHA_FALLBACK'
      : alphaBlendFromModel === null
        ? 'MISSING_INPUTS'
        : 'ALPHA_BLEND';
    const penalty = samplePenalty(sampleSize);
    const cap = confidenceCap(signalMode);
    const absScore = finalScore === null ? null : Math.abs(finalScore);
    const hasSources = hasItems(proposal?.sources) || hasItems(signal?.sources);
    const hasBacktest = hasValue(proposal?.pnlPercentage);
    const hasPrice = hasValue(proposal?.financialImpact?.currentPrice) || hasValue(proposal?.financialImpact?.currentValue);
    const scoreComponentKeys = Object.keys(scoreComponents).filter((key) => key !== 'hyperParams');
    const hasScoreComponents = scoreComponentKeys.length > 0;

    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];
    const missingData: string[] = [];

    if (finalScore !== null && absScore !== null && absScore > thresholds.signalThreshold) {
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
    if (hasSources) {
      positiveFactors.push('Có nguồn dữ liệu được gắn với đề xuất.');
    }
    if (hasBacktest) {
      positiveFactors.push('Đã có kết quả backtest/PnL cho đề xuất này.');
    }

    if (signalMode === 'COLD_START') {
      negativeFactors.push('COLD_START: thiếu lịch sử, confidence bị cap tối đa 40%.');
    }
    if (penalty !== null && penalty < 1) {
      negativeFactors.push(`Sample size thấp nên confidence bị nhân penalty ${penalty}.`);
    }
    if (!hasSources) {
      negativeFactors.push('Thiếu nguồn dữ liệu gắn với đề xuất.');
      missingData.push('sources');
    }
    if (finalScore === null) missingData.push('finalScore');
    if (sampleSize === null) missingData.push('sampleSize');
    if (!hasBacktest) missingData.push('backtest');
    if (!hasPrice) missingData.push('price');

    const dataSources: Array<{ label: string; status: ExplanationStatus; detail: string }> = [
      {
        label: 'Nguồn signal/proposal',
        status: hasSources ? 'OK' : 'MISSING',
        detail: hasSources
          ? 'Suy luận từ proposal.sources hoặc signal.sources hiện có; API này không tải thêm nguồn mới.'
          : 'Không thấy proposal.sources hoặc signal.sources trong dữ liệu hiện có.',
      },
      {
        label: 'Sample size',
        status: sampleSize === null ? 'MISSING' : penalty !== null && penalty < 1 ? 'LIMITED' : 'OK',
        detail: sampleSize === null
          ? 'Thiếu metadata.sampleSize/scoreComponents.sampleSize; trả null thay vì giả định 0.'
          : penalty !== null && penalty < 1
            ? `Suy luận từ sampleSize=${sampleSize}; mẫu thấp nên confidence bị penalty ${penalty}.`
            : `Suy luận từ sampleSize=${sampleSize}; mẫu đủ lớn để không bị sample penalty.`,
      },
      {
        label: 'Score components',
        status: hasScoreComponents ? 'OK' : 'MISSING',
        detail: hasScoreComponents
          ? `Suy luận từ scoreComponents hiện có: ${scoreComponentKeys.join(', ')}.`
          : 'Không thấy scoreComponents trong proposal hoặc signal metadata.',
      },
      {
        label: 'Backtest/PnL',
        status: hasBacktest ? 'OK' : 'MISSING',
        detail: hasBacktest
          ? 'Suy luận từ proposal.pnlPercentage; API này không chạy lại backtest.'
          : 'Chưa có proposal.pnlPercentage nên không trình bày như bằng chứng lợi nhuận.',
      },
      {
        label: 'Price/current value',
        status: hasPrice ? 'OK' : 'MISSING',
        detail: hasPrice
          ? 'Suy luận từ financialImpact.currentPrice hoặc financialImpact.currentValue.'
          : 'Thiếu currentPrice/currentValue trong financialImpact; không suy diễn bằng 0.',
      },
    ];

    const componentDescriptions: Record<string, string> = {
      finalScore: 'Điểm tổng hợp cuối cùng dùng để xét tín hiệu mạnh/yếu.',
      pureAlphaZ: 'Mức bất thường của token so với chính lịch sử của nó.',
      crossZ: 'Mức nổi bật của token so với nhóm/market tại cùng thời điểm.',
      timeZ: 'Tín hiệu theo thời gian, giúp đọc biến động hiện tại có khác thường không.',
      unifiedRaw: 'Điểm thô trước khi chuẩn hóa hoặc so ngưỡng.',
      sampleSize: 'Số mẫu lịch sử/quan sát được dùng để cap hoặc penalty confidence.',
    };

    const trustChecklist: Array<{ label: string; status: ExplanationStatus; detail: string }> = [
      {
        label: 'Có nguồn dữ liệu',
        status: hasSources ? 'OK' : 'MISSING',
        detail: hasSources
          ? 'Suy luận từ proposal.sources/signal.sources: có nguồn để FE hiển thị.'
          : 'Thiếu sources trong proposal/signal, đã giữ trong missingData.',
      },
      {
        label: 'Sample size đủ tin cậy',
        status: sampleSize === null ? 'MISSING' : penalty !== null && penalty < 1 ? 'LIMITED' : 'OK',
        detail: sampleSize === null
          ? 'Thiếu sampleSize nên không thể khẳng định độ rộng mẫu.'
          : penalty !== null && penalty < 1
            ? `Sample size thấp (${sampleSize}) nên confidence bị giảm bằng penalty ${penalty}.`
            : `Sample size=${sampleSize}, không bị sample penalty theo ngưỡng hiện tại.`,
      },
      {
        label: 'Chế độ signal',
        status: signalMode === 'COLD_START' ? 'LIMITED' : 'OK',
        detail: signalMode === 'COLD_START'
          ? 'COLD_START: thiếu lịch sử so sánh, confidence bị cap 0.4.'
          : `Suy luận từ signalMode=${signalMode}; không áp dụng cold-start cap.`,
      },
      {
        label: 'Score components',
        status: hasScoreComponents ? 'OK' : 'MISSING',
        detail: hasScoreComponents
          ? `Có ${scoreComponentKeys.length} component từ scoreComponents để FE diễn giải.`
          : 'Thiếu scoreComponents nên FE chỉ có thể hiển thị finalScore/confidence nếu có.',
      },
      {
        label: 'Backtest/PnL',
        status: hasBacktest ? 'OK' : 'MISSING',
        detail: hasBacktest
          ? 'Có proposal.pnlPercentage để tham chiếu kết quả quá khứ.'
          : 'Thiếu backtest/PnL, đã giữ trong missingData.',
      },
      {
        label: 'Missing data',
        status: missingData.length === 0 ? 'OK' : 'LIMITED',
        detail: missingData.length === 0
          ? 'Không phát hiện field bắt buộc bị thiếu trong route này.'
          : `Còn thiếu: ${missingData.join(', ')}.`,
      },
    ];

    const cautionChecklist: Array<{ label: string; detail: string }> = [
      {
        label: 'Confidence không phải xác suất lợi nhuận',
        detail: 'Confidence là độ mạnh tín hiệu sau cap/penalty, không đảm bảo trade có lời.',
      },
    ];

    if (signalMode === 'COLD_START') {
      cautionChecklist.push({
        label: 'COLD_START',
        detail: 'Thiếu lịch sử so sánh; confidence bị cap tối đa 0.4 để tránh tin quá mức.',
      });
    }

    if (penalty !== null && penalty < 1) {
      cautionChecklist.push({
        label: 'Sample size thấp',
        detail: `Sample size=${sampleSize}; confidence bị nhân penalty ${penalty}, kết quả có thể dao động mạnh.`,
      });
    }

    if (!hasBacktest) {
      cautionChecklist.push({
        label: 'Thiếu backtest/PnL',
        detail: 'Chưa có proposal.pnlPercentage nên không nên xem score như bằng chứng lợi nhuận.',
      });
    }

    if (missingData.length > 0) {
      cautionChecklist.push({
        label: 'Thiếu dữ liệu',
        detail: `missingData vẫn được giữ cho FE: ${missingData.join(', ')}.`,
      });
    }

    return NextResponse.json({
      confidenceFormula: signalMode === 'COLD_START'
        ? 'confidence = min(abs(finalScore) / coldStartConfidenceDivisor, 0.4)'
        : 'confidence = min(abs(finalScore) / confidenceDivisor, 0.95) * sampleSizePenalty',
      quantFormula: quantFormulaMode === 'PURE_ALPHA_FALLBACK'
        ? 'finalScore = pureAlphaZ'
        : quantFormulaMode === 'ALPHA_BLEND'
          ? 'finalScore = alphaBlend * pureAlphaZ + (1 - alphaBlend) * crossZ'
          : 'missing alphaBlend; cannot show detailed substitution',
      quantFormulaMode,
      alphaBlendDefault: DEFAULTS.alphaBlend,
      alphaBlendSource: alphaBlendFromModel === null ? 'missing' : 'model',
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
      dataSources,
      componentDescriptions,
      trustChecklist,
      cautionChecklist,
      auditTrail: [
        {
          step: 'Data ingestion',
          detail: hasSources ? 'Nguồn tin/social/price đã được gắn với signal.' : 'Chưa có nguồn hiển thị.',
          status: hasSources ? 'OK' : 'MISSING',
        },
        {
          step: 'Signal detection',
          detail: finalScore === null || absScore === null ? 'Thiếu finalScore.' : `finalScore=${finalScore.toFixed(3)}, abs=${absScore.toFixed(3)}.`,
          status: finalScore === null ? 'MISSING' : 'OK',
        },
        {
          step: 'Proposal generation',
          detail: `Action được normalize thành ${action}.`,
          status: 'OK',
        },
        {
          step: 'Backtest evaluation',
          detail: hasBacktest ? 'Đã có PnL/backtest.' : 'Chưa có PnL/backtest.',
          status: hasBacktest ? 'OK' : 'MISSING',
        },
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Score explanation API Error:', message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
