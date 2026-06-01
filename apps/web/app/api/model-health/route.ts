import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import mongoose from 'mongoose';
import {
  backtestRunsTable,
  hyperparameterConfigsTable,
} from '@gr2/shared';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const startedAt = Date.now();
    await connectDB();

    const [activeConfig, latestRun] = await Promise.all([
      (hyperparameterConfigsTable as mongoose.Model<any>)
        .findOne({ name: 'production', status: 'ACTIVE' })
        .sort({ updatedAt: -1 })
        .lean(),
      (backtestRunsTable as mongoose.Model<any>)
        .findOne({ type: 'HYPERPARAM_OPTIMIZATION' })
        .sort({ startedAt: -1 })
        .lean(),
    ]);

    return NextResponse.json({
      activeConfig: activeConfig
        ? {
            id: activeConfig._id?.toString(),
            status: activeConfig.status,
            params: activeConfig.params,
            metrics: activeConfig.metrics ?? {},
            promotedAt: activeConfig.promotedAt,
            updatedAt: activeConfig.updatedAt,
          }
        : null,
      latestBacktestRun: latestRun
        ? {
            id: latestRun._id?.toString(),
            status: latestRun.status,
            optimizer: latestRun.optimizer,
            trainWindow: latestRun.trainWindow,
            validationWindow: latestRun.validationWindow,
            metrics: latestRun.metrics ?? {},
            startedAt: latestRun.startedAt,
            endedAt: latestRun.endedAt,
          }
        : null,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error('Model health API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch model health', details: String(error) },
      { status: 500 }
    );
  }
}
