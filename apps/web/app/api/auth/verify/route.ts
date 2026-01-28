import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(req: Request) {
  try {
    const { walletAddress } = await req.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    await connectDB();

    // Tìm user bằng Mongoose
    const existingUser = await User.findOne({ walletAddress }).lean();

    if (existingUser) {
      // Kiểm tra xem user đã hoàn thành onboarding chưa (đã có name và riskTolerance)
      const hasCompletedOnboarding = !!(existingUser.riskTolerance && existingUser.name);

      return NextResponse.json({
        user: { ...existingUser, _id: existingUser._id.toString() },
        requiresOnboarding: !hasCompletedOnboarding // Nếu đã có thông tin -> false (bỏ qua onboarding)
      });
    }

    // Nếu chưa có -> Trả về flag để Client điều hướng sang trang tạo mới
    return NextResponse.json({
      requiresOnboarding: true,
      user: null
    });

  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}