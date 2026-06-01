import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

type ProposalDecision = 'ENTER' | 'WAIT' | 'REJECT';

type DecisionRequest = {
  blockers?: Array<{ label: string; severity: string }>;
  decision?: ProposalDecision;
  reason?: string;
  snapshot?: Record<string, unknown>;
  userId?: string;
  walletAddress?: string;
};

const VALID_DECISIONS = new Set<ProposalDecision>(['ENTER', 'WAIT', 'REJECT']);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
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

    let userObjectId: mongoose.Types.ObjectId | null = null;
    const walletAddress = body.walletAddress?.trim();

    if (walletAddress) {
      const user = await db.collection('users').findOne<{ _id: mongoose.Types.ObjectId }>({ walletAddress });
      if (user) userObjectId = user._id;
    }

    if (!userObjectId && body.userId && mongoose.Types.ObjectId.isValid(body.userId)) {
      userObjectId = new mongoose.Types.ObjectId(body.userId);
    }

    const audit = {
      proposalId,
      signalId: proposal.signalId ?? proposal.triggerSignalId ?? null,
      userId: userObjectId,
      walletAddress: walletAddress || null,
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
