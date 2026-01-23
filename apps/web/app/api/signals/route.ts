import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { SignalModel } from '@/models/Signal';

export async function GET() {
  try {
    await connectDB();

    // Ép kiểu query thành any để Mongoose không bắt bẻ
    const query: any = {
      expiresAt: { $gt: new Date() }//$gt (expiresAt > date)
    };

    const signals = await SignalModel.find(query)
      .sort({ detectedAt: -1 })
      .limit(20)
      .lean();

    return NextResponse.json(signals);//trả về http 200 và body là JSON array
  } catch (error: any) {
    console.error('Fetch Signals Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}