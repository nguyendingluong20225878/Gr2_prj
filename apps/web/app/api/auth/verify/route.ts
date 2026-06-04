import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import {
  createSession,
  getSessionUser,
  setSessionCookie,
  verifyWalletSignature,
} from '@/server/auth/walletAuth';

export async function GET(req: Request) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ user: null, requiresOnboarding: true }, { status: 401 });

    await connectDB();
    const existingUser = await User.findOne({ walletAddress: session.walletAddress }).lean();
    const hasCompletedOnboarding = Boolean(existingUser?.riskTolerance && existingUser?.name);

    return NextResponse.json({
      session: { walletAddress: session.walletAddress, userId: session.userId },
      user: existingUser ? { ...existingUser, _id: existingUser._id.toString() } : null,
      requiresOnboarding: !hasCompletedOnboarding,
    });
  } catch (error) {
    console.error('Session verify error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const walletAddress = await verifyWalletSignature({
      domain: req.nextUrl.host,
      message: body.message,
      signature: body.signature,
      walletAddress: body.walletAddress,
    });

    await connectDB();
    const existingUser = await User.findOne({ walletAddress }).lean();
    const hasCompletedOnboarding = Boolean(existingUser?.riskTolerance && existingUser?.name);
    const session = await createSession(walletAddress, existingUser?._id?.toString());

    const response = NextResponse.json({
      user: existingUser ? { ...existingUser, _id: existingUser._id.toString() } : null,
      requiresOnboarding: !hasCompletedOnboarding,
    });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    console.error('Verify error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status =
      message.includes('invalid') || message.includes('expired') || message.includes('missing') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
