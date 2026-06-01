import { signalsTable } from '@gr2/shared';

export type SignalSchema = Record<string, unknown>;
export type Signal = SignalSchema & { _id: string };

// Compatibility adapter: web routes keep importing from '@/models/Signal',
// but the actual Mongoose model now comes from core/shared.
export const SignalModel = signalsTable;
