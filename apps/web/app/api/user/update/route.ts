import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import UserModel from '@/models/User';

type UserUpdateRequest = {
  walletAddress?: string;
  name?: string;
  email?: string;
  riskTolerance?: string;
  tradeStyle?: string;
  notificationEnabled?: boolean;
};

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as UserUpdateRequest;
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
  } catch (error) {
    console.error('Update User Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
