import { SignalModel } from '@/models/Signal';
import { Types, type Model } from 'mongoose';

type SignalSuggestionType = 'buy' | 'sell' | 'hold' | 'stake' | 'close_position';

type SignalRecord = {
  _id?: unknown;
  suggestionType: SignalSuggestionType;
  detectedAt: Date;
  createdAt?: Date;
};

const suggestionTypeFilters = {
  BUY: ['buy', 'stake'],
  SELL: ['sell', 'close_position'],
  HOLD: ['hold'],
} as const;

export class SignalService {
  static async getSignals(
    limit: number = 10,
    filterType?: string,
    cursor?: { detectedAt: Date; id?: string }
  ) {
    const query: {
      suggestionType?: { $in: SignalSuggestionType[] };
      $or?: Array<Record<string, unknown>>;
    } = {};
    
    if (filterType && filterType !== 'ALL') {
      const normalizedType = filterType.toUpperCase() as keyof typeof suggestionTypeFilters;
      const suggestionTypes = suggestionTypeFilters[normalizedType];

      if (suggestionTypes) {
        query.suggestionType = { $in: [...suggestionTypes] };
      }
    }

    if (cursor) {
      const cursorObjectId = cursor.id && Types.ObjectId.isValid(cursor.id)
        ? new Types.ObjectId(cursor.id)
        : null;
      query.$or = [
        { detectedAt: { $lt: cursor.detectedAt } },
      ];
      if (cursorObjectId) {
        query.$or.push({
          detectedAt: cursor.detectedAt,
          _id: { $lt: cursorObjectId },
        });
      }
    }

    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 200)
      : 10;

    const signals = await (SignalModel as unknown as Model<SignalRecord>).find(query)
      .sort({ detectedAt: -1, _id: -1 })
      .limit(boundedLimit)
      .lean(); 

    return signals;
  }

  static async getSignalById(id: string) {
    return await (SignalModel as unknown as Model<SignalRecord>).findById(id).lean();
  }
}
