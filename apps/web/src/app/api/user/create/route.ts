import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/app/lib/mongodb';
import { User } from '@/app/models/User';

/**
 * POST /api/user/create
 * Create new user (onboarding)
 * Required: email, walletAddress
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      walletAddress, 
      name,
      age,
      tradeStyle,
      totalAssetUsd,
      cryptoInvestmentUsd,
      riskTolerance,
      image
    } = body;
    
    // Validation
    if (!email || !walletAddress) {
      return NextResponse.json(
        { error: 'Email and wallet address are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return NextResponse.json(
        { error: 'This email is already registered' },
        { status: 409 }
      );
    }
    
    // Check if wallet already exists
    const existingWallet = await User.findOne({ walletAddress });
    if (existingWallet) {
      return NextResponse.json(
        { error: 'This wallet is already registered' },
        { status: 409 }
      );
    }
    
    // Create new user
    const newUser = await User.create({
      email,
      walletAddress,
      name: name || '',
      age: age || null,
      tradeStyle: tradeStyle || '',
      totalAssetUsd: totalAssetUsd || 0,
      cryptoInvestmentUsd: cryptoInvestmentUsd || 0,
      riskTolerance: riskTolerance || 'medium',
      image: image || '',
      notificationEnabled: false,
      balances: [],
    });
    
    return NextResponse.json({
      success: true,
      user: {
        _id: newUser._id.toString(),
        email: newUser.email,
        walletAddress: newUser.walletAddress,
        name: newUser.name,
        riskTolerance: newUser.riskTolerance,
      }
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('User create error:', error);
    
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return NextResponse.json(
        { error: `This ${field} is already registered` },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
