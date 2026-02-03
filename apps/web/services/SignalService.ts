import { SignalModel } from '@/models/Signal';
import { Model } from 'mongoose'; // Import thêm type Model

export class SignalService {
  static async getSignals(limit: number = 10, filterType?: string) {
    const query: any = {};
    
    if (filterType && filterType !== 'ALL') {
       if (filterType === 'BUY') {
        query.suggestionType = { $in: ['BUY', 'LONG', 'STAKE'] };
      } else if (filterType === 'SELL') {
        query.suggestionType = { $in: ['SELL', 'SHORT', 'CLOSE_POSITION'] };
      } else if (filterType === 'HOLD') {
        query.suggestionType = { $in: ['HOLD', 'NEUTRAL'] };
      }
    }

    // === FIX LỖI Ở ĐÂY ===
    // Ép kiểu SignalModel về (Model<any>) để TS không còn bắt bẻ Union Type
    const signals = await (SignalModel as Model<any>).find(query)
      .sort({ detectedAt: -1 })
      .limit(limit)
      .lean(); 

    return signals;
  }

  static async getSignalById(id: string) {
    // === FIX LỖI Ở ĐÂY ===
    return await (SignalModel as Model<any>).findById(id).lean();
  }
}