import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import WatchlistModel from '@/models/Watchlist';
import { requireSessionUser } from '@/server/auth/walletAuth';

export const dynamic = 'force-dynamic';

function normalizeWatchStatus(value?: string | null) {
  const upper = String(value ?? '').toUpperCase();
  if (upper === 'RESOLVED' || upper === 'EXPIRED') return upper;
  return 'WATCHING';
}

export async function PATCH(req: Request, { params }: { params: { proposalId: string } }) {
  try {
    const session = await requireSessionUser(req);
    if (!mongoose.Types.ObjectId.isValid(params.proposalId)) {
      return NextResponse.json({ error: 'proposalId không hợp lệ' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const status = normalizeWatchStatus(body.status);
    await connectDB();

    const item = await WatchlistModel.findOneAndUpdate(
      {
        walletAddress: session.walletAddress,
        proposalId: new mongoose.Types.ObjectId(params.proposalId),
      },
      {
        $set: {
          status,
          reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined,
          resolvedAt: status === 'RESOLVED' || status === 'EXPIRED' ? new Date() : null,
        },
      },
      { new: true }
    ).lean();

    if (!item) {
      return NextResponse.json({ error: 'Không tìm thấy watchlist item' }, { status: 404 });
    }

    return NextResponse.json({
      _id: item._id?.toString(),
      proposalId: item.proposalId.toString(),
      userId: item.userId?.toString() ?? null,
      walletAddress: item.walletAddress ?? null,
      addedBy: item.addedBy,
      reason: item.reason ?? null,
      status: item.status,
      addedAt: item.addedAt,
      resolvedAt: item.resolvedAt ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && error.name === 'AuthRequiredError' ? 401 : 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: { proposalId: string } }) {
  try {
    const session = await requireSessionUser(req);
    if (!mongoose.Types.ObjectId.isValid(params.proposalId)) {
      return NextResponse.json({ error: 'proposalId không hợp lệ' }, { status: 400 });
    }

    await connectDB();
    await WatchlistModel.deleteOne({
      walletAddress: session.walletAddress,
      proposalId: new mongoose.Types.ObjectId(params.proposalId),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json(
      { error: message },
      { status: error instanceof Error && error.name === 'AuthRequiredError' ? 401 : 500 }
    );
  }
}
