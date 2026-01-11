import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/app/lib/mongodb';
import { User } from '@/app/models/User';

/**
 * GET /api/user/profile?wallet=...
 * Get user profile by wallet address
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    const user = await User.findOne({ walletAddress }).lean();
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      age: user.age,
      walletAddress: user.walletAddress,
      riskTolerance: user.riskTolerance,
      tradeStyle: user.tradeStyle,
      totalAssetUsd: user.totalAssetUsd,
      cryptoInvestmentUsd: user.cryptoInvestmentUsd,
      image: user.image,
      notificationEnabled: user.notificationEnabled,
      balances: user.balances,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
    
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/profile
 * Update user profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      walletAddress, 
      name,
      age,
      tradeStyle,
      totalAssetUsd,
      cryptoInvestmentUsd,
      riskTolerance,
      image,
      notificationEnabled
    } = body;
    
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Build update object (only include fields that are provided)
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (age !== undefined) updateData.age = age;
    if (tradeStyle !== undefined) updateData.tradeStyle = tradeStyle;
    if (totalAssetUsd !== undefined) updateData.totalAssetUsd = totalAssetUsd;
    if (cryptoInvestmentUsd !== undefined) updateData.cryptoInvestmentUsd = cryptoInvestmentUsd;
    if (riskTolerance !== undefined) updateData.riskTolerance = riskTolerance;
    if (image !== undefined) updateData.image = image;
    if (notificationEnabled !== undefined) updateData.notificationEnabled = notificationEnabled;
    
    const updatedUser = await User.findOneAndUpdate(
      { walletAddress },
      { $set: updateData },
      { new: true }
    ).lean();
    
    if (!updatedUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      user: {
        _id: updatedUser._id.toString(),
        email: updatedUser.email,
        name: updatedUser.name,
        age: updatedUser.age,
        walletAddress: updatedUser.walletAddress,
        riskTolerance: updatedUser.riskTolerance,
        tradeStyle: updatedUser.tradeStyle,
        totalAssetUsd: updatedUser.totalAssetUsd,
        cryptoInvestmentUsd: updatedUser.cryptoInvestmentUsd,
        image: updatedUser.image,
        notificationEnabled: updatedUser.notificationEnabled,
        updatedAt: updatedUser.updatedAt,
      }
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
