import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';

// GET Profile
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({ walletAddress }).lean();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ ...user, _id: user._id.toString() });

  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH Update Profile
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { walletAddress, ...updateData } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
    }

    await connectDB();

    const updatedUser = await User.findOneAndUpdate(
      { walletAddress },
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      user: { ...updatedUser, _id: updatedUser._id.toString() } 
    });

  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}