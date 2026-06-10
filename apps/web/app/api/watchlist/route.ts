import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Proposal from '@/models/Proposal';
import WatchlistModel from '@/models/Watchlist';
import { requireSessionUser } from '@/server/auth/walletAuth';

export const dynamic = 'force-dynamic';

type AnyRecord = Record<string, any>;
const ProposalModel = Proposal as unknown as mongoose.Model<AnyRecord>;

function normalizeWatchStatus(value?: string | null) {
  const upper = String(value ?? '').toUpperCase();
  if (upper === 'RESOLVED' || upper === 'EXPIRED') return upper;
  return 'WATCHING';
}

function normalizeAddedBy(value?: string | null) {
  return String(value ?? '').toUpperCase() === 'SYSTEM' ? 'SYSTEM' : 'USER';
}

function serializeProposal(proposal?: AnyRecord | null) {
  if (!proposal) return null;
  return {
    _id: proposal._id.toString(),
    tokenSymbol: proposal.tokenSymbol ?? null,
    tokenName: proposal.tokenName ?? proposal.title ?? null,
    action: proposal.action ?? proposal.suggestionType,
    suggestionType: proposal.suggestionType,
    title: proposal.title,
    summary: proposal.summary ?? proposal.rationaleSummary,
    confidence: proposal.confidence ?? null,
    financialImpact: proposal.financialImpact ?? {},
    roiStatus: proposal.financialImpact?.roi === null || proposal.financialImpact?.roi === undefined ? 'NOT_AVAILABLE' : 'AVAILABLE',
    pnlPercentage: proposal.pnlPercentage ?? null,
    winLossStatus: proposal.winLossStatus ?? null,
    backtestedAt: proposal.backtestedAt ?? null,
    expiresAt: proposal.expiresAt ?? null,
    createdAt: proposal.createdAt ?? null,
    status: proposal.status ?? proposal.executionStatus?.toLowerCase() ?? 'pending',
  };
}

export async function GET(req: Request) {
  try {
    const session = await requireSessionUser(req);
    await connectDB();

    const items = await WatchlistModel.find({ walletAddress: session.walletAddress })
      .sort({ addedAt: -1 })
      .limit(100)
      .lean();
    const proposalIds = items
      .map((item) => item.proposalId)
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
    const proposals = proposalIds.length
      ? await ProposalModel.find({ _id: { $in: proposalIds } }).lean<AnyRecord[]>()
      : [];
    const proposalById = new Map(proposals.map((proposal) => [proposal._id.toString(), proposal]));

    return NextResponse.json(items.map((item) => ({
      _id: item._id?.toString(),
      proposalId: item.proposalId.toString(),
      userId: item.userId?.toString() ?? null,
      walletAddress: item.walletAddress ?? null,
      addedBy: item.addedBy,
      reason: item.reason ?? null,
      status: item.status,
      addedAt: item.addedAt,
      resolvedAt: item.resolvedAt ?? null,
      proposal: serializeProposal(proposalById.get(item.proposalId.toString())),
    })));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && error.name === 'AuthRequiredError' ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSessionUser(req);
    const body = await req.json().catch(() => ({}));
    const proposalId = String(body.proposalId ?? '');
    if (!mongoose.Types.ObjectId.isValid(proposalId)) {
      return NextResponse.json({ error: 'proposalId không hợp lệ' }, { status: 400 });
    }

    await connectDB();
    const proposalObjectId = new mongoose.Types.ObjectId(proposalId);
    const proposal = await ProposalModel.findById(proposalObjectId).lean<AnyRecord | null>();
    if (!proposal) {
      return NextResponse.json({ error: 'Không tìm thấy proposal' }, { status: 404 });
    }

    const update = {
      $set: {
        proposalId: proposalObjectId,
        userId: session.userId && mongoose.Types.ObjectId.isValid(session.userId) ? new mongoose.Types.ObjectId(session.userId) : null,
        walletAddress: session.walletAddress,
        addedBy: normalizeAddedBy(body.addedBy),
        reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null,
        status: normalizeWatchStatus(body.status),
      },
      $setOnInsert: {
        addedAt: new Date(),
      },
    };

    const item = await WatchlistModel.findOneAndUpdate(
      { walletAddress: session.walletAddress, proposalId: proposalObjectId },
      update,
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({
      _id: item?._id?.toString(),
      proposalId,
      userId: item?.userId?.toString() ?? null,
      walletAddress: item?.walletAddress ?? null,
      addedBy: item?.addedBy ?? 'USER',
      reason: item?.reason ?? null,
      status: item?.status ?? 'WATCHING',
      addedAt: item?.addedAt ?? new Date(),
      resolvedAt: item?.resolvedAt ?? null,
      proposal: serializeProposal(proposal),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && error.name === 'AuthRequiredError' ? 401 : 500 }
    );
  }
}
