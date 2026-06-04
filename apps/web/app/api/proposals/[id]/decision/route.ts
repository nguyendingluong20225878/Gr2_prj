import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import { requireSessionUser } from '@/server/auth/walletAuth';

type ProposalDecision = 'ENTER' | 'WAIT' | 'REJECT';

type DecisionRequest = {
  blockers?: Array<{ label: string; severity: string }>;
  decision?: ProposalDecision;
  reason?: string;
  snapshot?: Record<string, unknown>;
};

const VALID_DECISIONS = new Set<ProposalDecision>(['ENTER', 'WAIT', 'REJECT']);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSessionUser(req);
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ error: 'Invalid proposal id' }, { status: 400 });
    }

    const body = (await req.json()) as DecisionRequest;
    if (!body.decision || !VALID_DECISIONS.has(body.decision)) {
      return NextResponse.json({ error: 'decision must be ENTER, WAIT, or REJECT' }, { status: 400 });
    }

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const proposalId = new mongoose.Types.ObjectId(params.id);
    const proposal = await db.collection('proposals').findOne({ _id: proposalId });
    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const walletAddress = session.walletAddress;
    const user = await db.collection('users').findOne<{ _id: mongoose.Types.ObjectId }>({ walletAddress });
    const userObjectId = user?._id ?? null;

    const audit = {
      proposalId,
      signalId: proposal.signalId ?? proposal.triggerSignalId ?? null,
      userId: userObjectId,
      walletAddress,
      decision: body.decision,
      reason: body.reason || '',
      blockersAtDecision: body.blockers || [],
      snapshot: body.snapshot || {},
      createdAt: new Date(),
    };

    const result = await db.collection('proposal_decisions').insertOne(audit);

    if (body.decision === 'REJECT') {
      await db.collection('proposals').updateOne(
        { _id: proposalId },
        {
          $set: {
            status: 'IGNORED',
            executionStatus: 'IGNORED',
            updatedAt: new Date(),
          },
        }
      );
    }

    return NextResponse.json({ success: true, decisionId: result.insertedId });
  } catch (error) {
    console.error('Decision Audit Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    const status = error instanceof Error && error.name === 'AuthRequiredError' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
