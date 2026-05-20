import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import UserModel from '@/models/User';

type UserBalanceUpdate = {
  tokenAddress: string;
  balance: string;
  updatedAt?: string | Date;
};

type UserProfilePatchRequest = {
  walletAddress?: string;
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
    const body = (await req.json()) as UserProfilePatchRequest;
    const { 
      walletAddress, 
      name, 
      email, 
      age, 
      riskTolerance, 
      tradeStyle, 
      notificationEnabled,
      balances // Nhận mảng balances từ client gửi về
    } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    await connectDB();

    // Xây dựng object update
    const updateData: Partial<Omit<UserProfilePatchRequest, 'walletAddress'>> = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (age !== undefined) updateData.age = age;
    if (riskTolerance !== undefined) updateData.riskTolerance = riskTolerance;
    if (tradeStyle !== undefined) updateData.tradeStyle = tradeStyle;
    if (notificationEnabled !== undefined) updateData.notificationEnabled = notificationEnabled;

    // Chỉ cập nhật balances nếu có dữ liệu gửi lên
    if (balances && Array.isArray(balances)) {
      updateData.balances = balances;
    }

    // Sử dụng findOneAndUpdate để cập nhật User
    const updatedUser = await UserModel.findOneAndUpdate(
      { walletAddress: walletAddress },
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
