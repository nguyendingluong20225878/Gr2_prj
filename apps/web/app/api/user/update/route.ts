import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import UserModel from '@/models/User';
import { requireSessionUser } from '@/server/auth/walletAuth';
import { sanitizeUserProfileInput } from '@/lib/utils/userInput';

type UserUpdateRequest = {
  name?: string;
  email?: string;
  riskTolerance?: string;
  tradeStyle?: string;
  notificationEnabled?: boolean;
};

export async function PUT(req: Request) {
  try {
    const session = await requireSessionUser(req);
    const body = (await req.json()) as UserUpdateRequest;
    const walletAddress = session.walletAddress;
    const profile = sanitizeUserProfileInput(body);

    await connectDB();

    const updatedUser = await UserModel.findOneAndUpdate(
      { walletAddress },
      { $set: profile },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Update User Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status =
      error instanceof Error && error.name === 'AuthRequiredError'
        ? 401
        : message.includes('must be') || message.includes('invalid') || message.includes('too long')
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
