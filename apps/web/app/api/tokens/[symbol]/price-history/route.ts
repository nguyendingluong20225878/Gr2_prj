import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { resolveToken, tokenPriceHistory } from '@gr2/shared';

export const dynamic = 'force-dynamic';

type AnyRecord = Record<string, any>;
type MissingReason = 'NO_TOKEN_MAPPING' | 'NO_PRICE_HISTORY';

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const PriceHistoryModel = tokenPriceHistory as unknown as mongoose.Model<AnyRecord>;

function parseDateParam(raw: string | null, name: string) {
  if (!raw) return { date: undefined };

  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    return { error: `Invalid ${name} date` };
  }

  return { date };
}

function parseLimit(raw: string | null) {
  if (!raw) return DEFAULT_LIMIT;

  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;

  return Math.min(Math.max(Math.floor(value), 1), MAX_LIMIT);
}

function uniqueStrings(values: unknown[]) {
  return [...new Set(values
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean))];
}

function numeric(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildPriceQuery(tokenIds: mongoose.Types.ObjectId[], tokenAddressKeys: string[], from?: Date, to?: Date) {
  const orFilters: AnyRecord[] = [];
  if (tokenAddressKeys.length) orFilters.push({ tokenAddress: { $in: tokenAddressKeys } });
  if (tokenIds.length) orFilters.push({ token: { $in: tokenIds } });

  const query: AnyRecord = orFilters.length ? { $or: orFilters } : {};
  const timestamp: AnyRecord = {};
  if (from) timestamp.$gte = from;
  if (to) timestamp.$lte = to;
  if (Object.keys(timestamp).length) query.timestamp = timestamp;

  return query;
}

function emptyResponse(tokenSymbol: string, tokenAddress: string | null, missingReason: MissingReason) {
  return NextResponse.json({
    tokenSymbol,
    tokenAddress,
    data: [],
    missingReason,
  });
}

export async function GET(request: Request, { params }: { params: { symbol: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenSymbol = decodeURIComponent(params.symbol).trim().toUpperCase();
    const from = parseDateParam(searchParams.get('from'), 'from');
    const to = parseDateParam(searchParams.get('to'), 'to');
    const limit = parseLimit(searchParams.get('limit'));

    if (!tokenSymbol) {
      return NextResponse.json({ error: 'Missing token symbol' }, { status: 400 });
    }

    if (from.error) {
      return NextResponse.json({ error: from.error }, { status: 400 });
    }

    if (to.error) {
      return NextResponse.json({ error: to.error }, { status: 400 });
    }

    if (from.date && to.date && from.date.getTime() > to.date.getTime()) {
      return NextResponse.json({ error: 'from must be before or equal to to' }, { status: 400 });
    }

    await connectDB();

    const resolvedToken = await resolveToken({
      chain: 'solana',
      symbol: tokenSymbol,
    });

    if (!resolvedToken) {
      return emptyResponse(tokenSymbol, null, 'NO_TOKEN_MAPPING');
    }

    const tokenAddress = resolvedToken.primaryAddress ?? resolvedToken.address ?? null;
    const resolvedTokenId = resolvedToken._id && mongoose.Types.ObjectId.isValid(String(resolvedToken._id))
      ? new mongoose.Types.ObjectId(String(resolvedToken._id))
      : null;
    const tokenAddressKeys = uniqueStrings([
      tokenSymbol,
      resolvedToken.address,
      resolvedToken.primaryAddress,
      resolvedToken.canonicalKey,
      resolvedToken.coingeckoId,
      ...(resolvedToken.aliases ?? []).map((alias: AnyRecord) => alias.value),
    ]);
    const tokenIds = resolvedTokenId ? [resolvedTokenId] : [];

    const rows = await PriceHistoryModel.find(buildPriceQuery(tokenIds, tokenAddressKeys, from.date, to.date))
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean<AnyRecord[]>();

    const data = rows
      .flatMap((row): Array<{ timestamp: Date; price: number; source?: string }> => {
        const timestamp = row.timestamp ? new Date(row.timestamp) : null;
        const price = numeric(row.priceUsd);

        if (!timestamp || !Number.isFinite(timestamp.getTime()) || price === null) return [];

        return [{
          timestamp,
          price,
          ...(typeof row.source === 'string' ? { source: row.source } : {}),
        }];
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map((row) => ({
        timestamp: row.timestamp.toISOString(),
        price: row.price,
        ...(row.source ? { source: row.source } : {}),
      }));

    if (!data.length) {
      return emptyResponse(tokenSymbol, tokenAddress, 'NO_PRICE_HISTORY');
    }

    return NextResponse.json({
      tokenSymbol,
      tokenAddress,
      data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Token price history API Error:', message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
