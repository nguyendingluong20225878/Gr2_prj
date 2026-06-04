import { NextResponse } from 'next/server';
import { clearSessionCookie, revokeSession } from '@/server/auth/walletAuth';

export async function POST(req: Request) {
  try {
    await revokeSession(req);
  } catch (error) {
    console.error('Logout error:', error);
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
