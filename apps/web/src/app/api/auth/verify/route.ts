import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/app/lib/mongodb';
import { User } from '@/app/models/User';

/**
 * POST /api/auth/verify
 * Check if wallet address exists in database
 * Returns user data if exists, or requiresOnboarding flag
 */
export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find user by wallet address
    const user = await User.findOne({ walletAddress }).lean();
    
    if (!user) {
      return NextResponse.json({
        exists: false,
        requiresOnboarding: true,
      });
    }
    
    // User exists, return user data
    return NextResponse.json({
      exists: true,
      requiresOnboarding: false,
      user: {
        _id: user._id.toString(),
        email: user.email,
        name: user.name,
        walletAddress: user.walletAddress,
        riskTolerance: user.riskTolerance,
        tradeStyle: user.tradeStyle,
        totalAssetUsd: user.totalAssetUsd,
        cryptoInvestmentUsd: user.cryptoInvestmentUsd,
        image: user.image,
        notificationEnabled: user.notificationEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    });
    
  } catch (error) {
    console.error('Auth verify error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
