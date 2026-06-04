import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import mongoose from 'mongoose';
import { ed25519 } from '@noble/curves/ed25519';
import connectDB from '@/lib/mongodb';
import { sanitizeWalletAddress } from '@/lib/utils/userInput';

export const AUTH_COOKIE_NAME = 'ndl_session';
const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AuthNonceRecord = {
  _id: mongoose.Types.ObjectId;
  consumedAt?: Date;
  createdAt: Date;
  domain: string;
  expiresAt: Date;
  message: string;
  nonceHash: string;
  walletAddress: string;
};

export type SessionUser = {
  sessionId: string;
  userId: string | null;
  walletAddress: string;
};

type SessionRecord = {
  _id: mongoose.Types.ObjectId;
  expiresAt: Date;
  revokedAt?: Date;
  tokenHash: string;
  userId?: mongoose.Types.ObjectId | null;
  walletAddress: string;
};

const hashValue = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export function buildWalletAuthMessage(params: {
  domain: string;
  issuedAt: string;
  nonce: string;
  walletAddress: string;
}) {
  return [
    'NDL Wallet Authentication',
    '',
    `Domain: ${params.domain}`,
    `Wallet: ${params.walletAddress}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    '',
    'Sign this message to authenticate. This does not approve a transaction.',
  ].join('\n');
}

export async function createWalletNonce(walletAddressInput: unknown, domain: string) {
  const walletAddress = sanitizeWalletAddress(walletAddressInput);
  const nonce = crypto.randomBytes(32).toString('base64url');
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS);
  const message = buildWalletAuthMessage({ domain, issuedAt, nonce, walletAddress });

  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  await db.collection('wallet_auth_nonces').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection<AuthNonceRecord>('wallet_auth_nonces').insertOne({
    _id: new mongoose.Types.ObjectId(),
    walletAddress,
    nonceHash: hashValue(nonce),
    domain,
    message,
    createdAt: new Date(),
    expiresAt,
  });

  return { expiresAt, message, nonce, walletAddress };
}

export async function verifyWalletSignature(input: {
  domain: string;
  message: unknown;
  signature: unknown;
  walletAddress: unknown;
}) {
  const walletAddress = sanitizeWalletAddress(input.walletAddress);
  if (typeof input.message !== 'string' || input.message.length > 1000) {
    throw new Error('message is invalid');
  }
  if (typeof input.signature !== 'string') {
    throw new Error('signature must be a string');
  }

  const nonce = input.message.match(/^Nonce: ([A-Za-z0-9_-]+)$/m)?.[1];
  if (!nonce) throw new Error('nonce is missing from message');

  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  const nonceRecord = await db.collection<AuthNonceRecord>('wallet_auth_nonces').findOne({
    walletAddress,
    nonceHash: hashValue(nonce),
    domain: input.domain,
    message: input.message,
    consumedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!nonceRecord) throw new Error('nonce is invalid or expired');

  const publicKey = new PublicKey(walletAddress);
  const signatureBytes = bs58.decode(input.signature);
  const messageBytes = new TextEncoder().encode(input.message);
  const verified = ed25519.verify(signatureBytes, messageBytes, publicKey.toBytes());

  if (!verified) throw new Error('signature is invalid');

  const consumeResult = await db.collection<AuthNonceRecord>('wallet_auth_nonces').updateOne(
    { _id: nonceRecord._id, consumedAt: { $exists: false } },
    { $set: { consumedAt: new Date() } }
  );
  if (consumeResult.modifiedCount !== 1) throw new Error('nonce was already used');

  return walletAddress;
}

export async function createSession(walletAddress: string, userId?: mongoose.Types.ObjectId | string | null) {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const objectUserId =
    userId && mongoose.Types.ObjectId.isValid(String(userId))
      ? new mongoose.Types.ObjectId(String(userId))
      : null;

  await db.collection('auth_sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection<SessionRecord>('auth_sessions').insertOne({
    _id: new mongoose.Types.ObjectId(),
    walletAddress,
    userId: objectUserId,
    tokenHash: hashValue(token),
    expiresAt,
  });

  return { expiresAt, token };
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: Date) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  });
}

export async function getSessionUser(req?: Request): Promise<SessionUser | null> {
  const token =
    req?.headers
      .get('cookie')
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
      ?.slice(AUTH_COOKIE_NAME.length + 1) || cookies().get(AUTH_COOKIE_NAME)?.value;

  if (!token) return null;

  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  const session = await db.collection<SessionRecord>('auth_sessions').findOne({
    tokenHash: hashValue(token),
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  if (!session) return null;

  return {
    sessionId: session._id.toString(),
    userId: session.userId?.toString() ?? null,
    walletAddress: session.walletAddress,
  };
}

export async function requireSessionUser(req?: Request) {
  const session = await getSessionUser(req);
  if (!session) {
    const error = new Error('Authentication required');
    error.name = 'AuthRequiredError';
    throw error;
  }
  return session;
}

export async function revokeSession(req: Request) {
  const token = req.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(AUTH_COOKIE_NAME.length + 1);

  if (!token) return;
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');
  await db.collection('auth_sessions').updateOne(
    { tokenHash: hashValue(token), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
}
