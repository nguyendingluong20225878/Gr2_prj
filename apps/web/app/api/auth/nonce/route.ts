import { NextRequest, NextResponse } from 'next/server';
import { createWalletNonce } from '@/server/auth/walletAuth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const domain = req.nextUrl.host;
    const nonce = await createWalletNonce(body.walletAddress, domain);

    return NextResponse.json({
      expiresAt: nonce.expiresAt,
      message: nonce.message,
      nonce: nonce.nonce,
      walletAddress: nonce.walletAddress,
    });
  } catch (error) {
    console.error('Nonce error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const status = message.includes('walletAddress') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
