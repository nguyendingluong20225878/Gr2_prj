import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import UserModel from '@/models/User';
import { requireSessionUser } from '@/server/auth/walletAuth';
import { sanitizeBalancesInput, sanitizeUserProfileInput } from '@/lib/utils/userInput';
import { resolveToken } from '@gr2/shared';

type UserBalanceUpdate = {
  tokenAddress: string;
  balance: string;
  updatedAt?: string | Date;
};

type UserProfilePatchRequest = {
  name?: string;
  email?: string;
  age?: number;
  riskTolerance?: string;
  tradeStyle?: string;
  notificationEnabled?: boolean;
  balances?: UserBalanceUpdate[];
};

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSessionUser(req);
    const body = (await req.json()) as UserProfilePatchRequest;
    const walletAddress = session.walletAddress;
    const profile = sanitizeUserProfileInput(body);
    const balances = sanitizeBalancesInput(body.balances);
    const balancesWithToken = balances
      ? await Promise.all(balances.map(async (balance) => {
          const token = await resolveToken({
            chain: 'solana',
            addressOrMint: balance.tokenAddress,
          });

          return {
            ...balance,
            ...(token?._id ? { token: token._id } : {}),
          };
        }))
      : undefined;

    await connectDB();

    const updateData = {
      ...profile,
      ...(balancesWithToken !== undefined ? { balances: balancesWithToken } : {}),
    };

    // Sử dụng findOneAndUpdate để cập nhật User
    const updatedUser = await UserModel.findOneAndUpdate(
      { walletAddress },
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Profile updated successfully', 
      user: updatedUser 
    });

  } catch (error) {
    console.error('[API Profile PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status =
      error instanceof Error && error.name === 'AuthRequiredError'
        ? 401
        : message.includes('must be') || message.includes('invalid') || message.includes('too long') || message.includes('required')
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
