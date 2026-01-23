import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import UserModel from '@/models/User';

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    await connectDB();

    if (!body.walletAddress) {
      return NextResponse.json({ error: 'Missing wallet address' }, { status: 400 });
    }

    // Tìm và update user
    const updatedUser = await UserModel.findOneAndUpdate(
      { walletAddress: body.walletAddress },
      {
        $set: {
          name: body.name,
          email: body.email,
          riskTolerance: body.riskTolerance,
          tradeStyle: body.tradeStyle,
          notificationEnabled: body.notificationEnabled,
          // Thêm các trường khác nếu cần
        }
      },
      { new: true } // Trả về document sau khi update
    );

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error('Update User Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}