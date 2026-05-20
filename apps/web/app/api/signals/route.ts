import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { SignalService } from '@/services/SignalService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const type = searchParams.get('type') || 'ALL'; // Hỗ trợ lọc theo type
    
    await connectDB();

    const signals = await SignalService.getSignals(limit, type);
    
    return NextResponse.json(signals);
  } catch (error) {
    console.error("API Error:", error); // Ở đây có thể dùng Logger của Server nếu muốn
    return NextResponse.json(
      { error: 'Failed to fetch signals', details: String(error) }, 
      { status: 500 }
    );
  }
}
