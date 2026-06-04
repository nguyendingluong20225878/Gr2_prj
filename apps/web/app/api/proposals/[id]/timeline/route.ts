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

function markerFromProposal(proposal: AnyRecord, currentId: string, backtest?: AnyRecord | null) {
  const result = markerResult(proposal, backtest);
  return {
    id: proposal._id.toString(),
    date: proposal.createdAt ?? proposal.backtestMeta?.detectedAt ?? backtest?.detectedAt ?? null,
    action: normalizeAction(proposal.action ?? proposal.suggestionType ?? proposal.type),
    confidence: normalizeConfidence(proposal.confidence),
    quant: numeric(proposal.quantScore ?? proposal.scoreComponents?.finalScore),
    result,
    pnlPercentage: normalizePercent(proposal.pnlPercentage ?? backtest?.pnlPercentage),
    entryPrice: numeric(proposal.entryPrice ?? backtest?.entryPrice),
    exitPrice: numeric(proposal.exitPrice ?? backtest?.exitPrice),
    expirationTime: proposal.expiresAt ?? proposal.backtestMeta?.expiresAt ?? backtest?.expiresAt ?? null,
    isCurrent: proposal._id.toString() === currentId,
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
    const windowStart = new Date(createdAt.getTime() - 180 * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(Math.max(Date.now(), createdAt.getTime() + 7 * 24 * 60 * 60 * 1000));
    const missingData: string[] = [];

    const proposalFilters: AnyRecord[] = [];
    if (tokenAddress) proposalFilters.push({ tokenAddress });
    if (tokenSymbol) proposalFilters.push({ tokenSymbol });
    const proposalQuery: AnyRecord = proposalFilters.length ? { $or: proposalFilters } : { _id: proposal._id };

    const [historicalProposals, priceRows, backtests] = await Promise.all([
      ProposalModel.find(proposalQuery)
        .sort({ createdAt: 1 })
        .limit(80)
        .lean<AnyRecord[]>(),
      tokenAddressKeys.length || tokenIds.length
        ? PriceHistoryModel.find(buildPriceQuery(tokenIds, tokenAddressKeys, windowStart, windowEnd))
          .sort({ timestamp: 1 })
          .limit(500)
          .lean<AnyRecord[]>()
        : Promise.resolve([]),
      BacktestModel.find(proposalQuery)
        .sort({ detectedAt: 1 })
        .limit(80)
        .lean<AnyRecord[]>(),
    ]);

    if (!tokenAddress && !resolvedToken) missingData.push('tokenAddress');
    if (!priceRows.length) missingData.push('priceHistory');
    if (!historicalProposals.some((item) => item._id.toString() !== params.id)) missingData.push('historicalProposals');
    if (!backtests.length && (proposal.pnlPercentage === null || proposal.pnlPercentage === undefined)) missingData.push('backtestResults');

    const backtestByProposalId = new Map(backtests.map((row) => [String(row.proposalId), row]));
    const currentBacktest = backtestByProposalId.get(params.id) ?? null;
    const markers = historicalProposals.map((item) => markerFromProposal(item, params.id, backtestByProposalId.get(item._id.toString())));

    return NextResponse.json({
      token: {
        symbol: tokenSymbol,
        address: tokenAddress ?? resolvedToken?.primaryAddress ?? resolvedToken?.address ?? null,
      },
      priceHistory: priceRows.map((row) => ({
        timestamp: row.timestamp,
        price: numeric(row.priceUsd),
        source: row.source,
      })).filter((row) => row.price !== null),
      currentProposal: markerFromProposal(proposal, params.id, currentBacktest),
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
