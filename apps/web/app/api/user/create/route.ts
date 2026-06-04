import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import UserModel from '@/models/User';
import { requireSessionUser } from '@/server/auth/walletAuth';
import { sanitizeUserProfileInput } from '@/lib/utils/userInput';

type CreateUserRequest = {
  name?: string;
  email?: string;
  age?: number;
  riskTolerance?: string;
  tradeStyle?: string;
  totalAssetUsd?: number | string;
  cryptoInvestmentUsd?: number | string;
};

export async function POST(req: Request) {
  try {
    const session = await requireSessionUser(req);
    const body = (await req.json()) as CreateUserRequest;
    const walletAddress = session.walletAddress;
    const profile = sanitizeUserProfileInput(body);

    await connectDB();

    const existingUser = await UserModel.findOne({ walletAddress });
    if (existingUser) {
      return NextResponse.json(existingUser);
    }

    const newUser = await UserModel.create({
      walletAddress,
      name: profile.name || 'Anonymous',
      email: profile.email || '',
      age: profile.age || 0,
      riskTolerance: profile.riskTolerance || 'medium',
      tradeStyle: profile.tradeStyle || 'swing',
      totalAssetUsd: profile.totalAssetUsd || 0,
      cryptoInvestmentUsd: profile.cryptoInvestmentUsd || 0,
      notificationEnabled: true,
      role: 'user'
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('Create User Error:', error);
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
