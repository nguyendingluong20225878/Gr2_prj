import { SignalModel } from '@/models/Signal';
import type { Model } from 'mongoose';

type SignalSuggestionType = 'buy' | 'sell' | 'hold' | 'stake' | 'close_position';

type SignalRecord = {
  suggestionType: SignalSuggestionType;
  detectedAt: Date;
};

const suggestionTypeFilters = {
  BUY: ['buy', 'stake'],
  SELL: ['sell', 'close_position'],
  HOLD: ['hold'],
} as const;

export class SignalService {
  static async getSignals(limit: number = 10, filterType?: string) {
    const query: { suggestionType?: { $in: SignalSuggestionType[] } } = {};
    
    if (filterType && filterType !== 'ALL') {
      const normalizedType = filterType.toUpperCase() as keyof typeof suggestionTypeFilters;
      const suggestionTypes = suggestionTypeFilters[normalizedType];

      if (suggestionTypes) {
        query.suggestionType = { $in: [...suggestionTypes] };
      }
    }

    const signals = await (SignalModel as unknown as Model<SignalRecord>).find(query)
      .sort({ detectedAt: -1 })
      .limit(limit)
      .lean(); 

    return signals;
  }

  static async getSignalById(id: string) {
    return await (SignalModel as unknown as Model<SignalRecord>).findById(id).lean();
  }
}
