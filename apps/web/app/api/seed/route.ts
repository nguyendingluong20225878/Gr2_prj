import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Proposal from '@/models/Proposal';

export async function GET() {
  await connectDB();
  
  // Xóa cũ
  await Proposal.deleteMany({});

  // Tạo mới mẫu
  await Proposal.create([
    {
      tokenSymbol: 'SOL',
      tokenName: 'Solana',
      action: 'BUY',
      confidence: 92,
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
      sources: ['https://twitter.com/solana/status/123456'],
      status: 'ACTIVE'
    },
    {
      tokenSymbol: 'JUP',
      tokenName: 'Jupiter',
      action: 'HOLD',
      confidence: 65,
      currentPrice: 1.2,
      targetPrice: 1.5,
      expectedReturn: 25,
      socialScore: 70,
      title: 'Jupiter Consolidation',
      summary: 'Price is consolidating at support levels.',
      status: 'ACTIVE'
    }
  ]);

  return NextResponse.json({ message: 'Database Seeded!' });
}