import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';

type TradeDirection = 'LONG' | 'SHORT';

type TradeExecuteRequest = {
  userId?: string;
  walletAddress?: string;
  tokenSymbol?: string;
  tokenAddress?: string;
  amount?: number | string;
  entryPrice?: number | string;
  direction?: string;
  leverage?: number | string;
  proposalId?: string;
};

type ProposalTradeRecord = {
  _id: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | string;
  tokenSymbol?: string;
  tokenAddress?: string;
  status?: string;
  executionStatus?: string;
};

const MAX_LEVERAGE = 10;

const parsePositiveNumber = (value: unknown, fieldName: string) => {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }

  return parsed;
};

const parseDirection = (value: unknown): TradeDirection => {
  if (value === 'SHORT') return 'SHORT';
  if (value === undefined || value === null || value === 'LONG') return 'LONG';
  throw new Error('direction must be LONG or SHORT');
};

const assertObjectId = (value: string | undefined, fieldName: string) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`${fieldName} is invalid`);
  }

  return new mongoose.Types.ObjectId(value);
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TradeExecuteRequest;
    const { 
      userId, 
      tokenSymbol, 
      tokenAddress, 
      amount, 
      entryPrice, 
      direction, // 'LONG' hoặc 'SHORT'
      leverage,
      proposalId 
    } = body;

    const walletAddress = body.walletAddress?.trim();
    if (!walletAddress || !amount || !entryPrice || !proposalId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not connected');
    }

    const user = await db.collection('users').findOne<{ _id: mongoose.Types.ObjectId; walletAddress: string }>({
      walletAddress,
    });

    if (!user) {
      return NextResponse.json({ error: 'Wallet session is not associated with a user' }, { status: 401 });
    }

    if (userId && (!mongoose.Types.ObjectId.isValid(userId) || !user._id.equals(new mongoose.Types.ObjectId(userId)))) {
      return NextResponse.json({ error: 'User does not match wallet session' }, { status: 403 });
    }

    const proposalObjectId = assertObjectId(proposalId, 'proposalId');
    const proposal = await db.collection<ProposalTradeRecord>('proposals').findOne({
      _id: proposalObjectId,
      $or: [
        { status: { $in: ['pending', 'active', 'ACTIVE'] } },
        { executionStatus: 'PENDING' },
      ],
    });

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found or not executable' }, { status: 404 });
    }

    if (proposal.userId && proposal.userId.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Proposal does not belong to wallet session' }, { status: 403 });
    }

    const positionDirection = parseDirection(direction);
    const positionSize = parsePositiveNumber(amount, 'amount');
    const parsedEntryPrice = parsePositiveNumber(entryPrice, 'entryPrice');
    const parsedLeverage = leverage === undefined ? 1 : parsePositiveNumber(leverage, 'leverage');

    if (!Number.isInteger(parsedLeverage) || parsedLeverage > MAX_LEVERAGE) {
      return NextResponse.json({ error: `leverage must be an integer from 1 to ${MAX_LEVERAGE}` }, { status: 400 });
    }

    const finalTokenSymbol = tokenSymbol || proposal.tokenSymbol;
    const finalTokenAddress = tokenAddress || proposal.tokenAddress;

    if (!finalTokenSymbol || !finalTokenAddress) {
      return NextResponse.json({ error: 'Token metadata is missing' }, { status: 400 });
    }

    const existingPosition = await db.collection('perp_positions').findOne({
      userId: user._id,
      proposalId: proposalObjectId,
      status: 'open',
    });

    if (existingPosition) {
      return NextResponse.json({ error: 'Proposal already has an open position for this wallet' }, { status: 409 });
    }

    const newPosition = {
      userId: user._id,
      proposalId: proposalObjectId,
      tokenSymbol: finalTokenSymbol,
      tokenAddress: finalTokenAddress,
      positionType: 'PERPETUAL',
      positionDirection,
      leverage: parsedLeverage,
      entryPrice: parsedEntryPrice,
      markPrice: parsedEntryPrice,
      liquidationPrice: 0, // Tính sau
      positionSize,
      collateral: positionSize,
      pnl: 0,
      roi: 0,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('perp_positions').insertOne(newPosition);

    const proposalUpdate = await db.collection('proposals').updateOne(
      {
        _id: proposalObjectId,
        $or: [
          { status: { $in: ['pending', 'active', 'ACTIVE'] } },
          { executionStatus: 'PENDING' },
        ],
      },
      {
        $set: {
          status: 'EXECUTED',
          executionStatus: 'EXECUTED',
          updatedAt: new Date(),
        },
      }
    );

    if (proposalUpdate.modifiedCount === 0) {
      await db.collection('perp_positions').deleteOne({ _id: result.insertedId });
      return NextResponse.json({ error: 'Proposal was already executed' }, { status: 409 });
    }

    return NextResponse.json({ success: true, positionId: result.insertedId });

  } catch (error) {
    console.error('Execute Trade Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    const status = message.includes('invalid') || message.includes('must be') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
