import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../../../core/shared/src/db/connection';
import { usersTable } from '../../../../../../core/shared/src/db/schema/users';

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
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

    await connectToDatabase();

    // Xây dựng object update
    const updateData: any = {
      name,
      email,
      age,
      riskTolerance,
      tradeStyle,
      notificationEnabled,
    };

    // Chỉ cập nhật balances nếu có dữ liệu gửi lên
    if (balances && Array.isArray(balances)) {
      updateData.balances = balances;
    }

    // Sử dụng findOneAndUpdate để cập nhật User
    const updatedUser = await usersTable.findOneAndUpdate(
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

  } catch (error: any) {
    console.error('[API Profile PATCH] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}