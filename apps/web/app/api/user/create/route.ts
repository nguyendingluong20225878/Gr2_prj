import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import UserModel from '@/models/User';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await connectDB();

    if (!body.walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const existingUser = await UserModel.findOne({ walletAddress: body.walletAddress });
    if (existingUser) {
      return NextResponse.json(existingUser);
    }

    const newUser = await UserModel.create({
      walletAddress: body.walletAddress,
      name: body.name || 'Anonymous',
      email: body.email || '', 
      age: body.age || 0, // Thêm dòng này để lưu tuổi
      riskTolerance: body.riskTolerance || 'medium',
      tradeStyle: body.tradeStyle || 'swing',
      totalAssetUsd: Number(body.totalAssetUsd) || 0,
      cryptoInvestmentUsd: Number(body.cryptoInvestmentUsd) || 0,
      notificationEnabled: true,
      role: 'user'
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    console.error('Create User Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}