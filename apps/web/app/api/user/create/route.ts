import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      email, walletAddress, name, 
      tradeStyle, totalAssetUsd, cryptoInvestmentUsd, 
      riskTolerance, image 
    } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    await connectDB();

    // Kiểm tra trùng lặp
    const existing = await User.findOne({ 
      $or: [{ walletAddress }, { email: email || '' }] 
    });

    if (existing) {
      // Nếu trùng wallet thì trả về lỗi, nhưng nếu trùng email (mà email rỗng) thì bỏ qua
      if (existing.walletAddress === walletAddress) {
        return NextResponse.json({ error: 'Wallet already registered' }, { status: 409 });
      }
      if (email && existing.email === email) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      }
    }

    // Tạo user mới
    const newUser = await User.create({
      email,
      walletAddress,
      name: name || '',
      tradeStyle: tradeStyle || '',
      totalAssetUsd: totalAssetUsd || 0,
      cryptoInvestmentUsd: cryptoInvestmentUsd || 0,
      riskTolerance: riskTolerance || 'medium',
      image: image || '',
      notificationEnabled: true,
    });

    return NextResponse.json({
      success: true,
      user: { ...newUser.toObject(), _id: newUser._id.toString() }
    }, { status: 201 });

  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}