import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Proposal from '@/models/Proposal';

export const dynamic = 'force-dynamic';

function canRunSeed(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  const seedSecret = process.env.SEED_API_SECRET;
  if (!seedSecret) {
    return false;
  }

  const requestSecret = req.headers.get('x-seed-secret') ?? new URL(req.url).searchParams.get('secret');
  return requestSecret === seedSecret;
}

export async function GET(req: Request) {
  if (!canRunSeed(req)) {
    return NextResponse.json({ error: 'Seed route disabled' }, { status: 404 });
  }

  await connectDB();
  
  // Xóa cũ
  await (Proposal as any).deleteMany({});

  // Tạo mới mẫu
  await (Proposal as any).create([
    {
      tokenSymbol: 'SOL',
      tokenAddress: 'So11111111111111111111111111111111111111112',
      tokenName: 'Solana',
      action: 'BUY',
      suggestionType: 'buy',
      sentimentType: 'positive',
      quantScore: 1.4,
      confidence: 92,
      rationaleSummary: 'Strong volume detected on DEXs. Social sentiment is highly positive following the new update.',
      currentPrice: 145.2,
      targetPrice: 160.0,
      expectedReturn: 10.2,
      socialScore: 85,
      title: 'Solana Breakout Confirmed',
      summary: 'Strong volume detected on DEXs. Social sentiment is highly positive following the new update.',
      analysis: {
        reasoning: ['Volume spike +200%', 'Whale accumulation detected'],
        timeHorizon: '3-5 Days'
      },
      sources: [{ label: 'X (Twitter)', url: 'https://twitter.com/solana/status/123456' }],
      status: 'ACTIVE',
      executionStatus: 'PENDING'
    },
    {
      tokenSymbol: 'JUP',
      tokenAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      tokenName: 'Jupiter',
      action: 'HOLD',
      suggestionType: 'hold',
      sentimentType: 'neutral',
      quantScore: 0.2,
      confidence: 65,
      rationaleSummary: 'Price is consolidating at support levels.',
      currentPrice: 1.2,
      targetPrice: 1.5,
      expectedReturn: 25,
      socialScore: 70,
      title: 'Jupiter Consolidation',
      summary: 'Price is consolidating at support levels.',
      sources: [{ label: 'Seed', url: '#' }],
      status: 'ACTIVE',
      executionStatus: 'PENDING'
    }
  ]);

  return NextResponse.json({ message: 'Database Seeded!' });
}
