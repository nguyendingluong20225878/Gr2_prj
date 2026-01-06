import { logsTable } from "../db/schema";

export type DbLogStatus = "processing" | "success" | "failed";

export interface DbLogEntry {
  step: string;
  message: string;
  status: DbLogStatus;
  metadata?: Record<string, any>;
}

export async function createDbLog(entry: DbLogEntry): Promise<void> {
  try {
    const log = new logsTable(entry);
    await log.save();
  } catch (error) {
    console.error("Failed to create db log:", error);
  }
}

export const logProcessing = (
  step: string,
  message: string,
  metadata?: Record<string, any>,
) => createDbLog({ step, message, status: "processing", metadata });

export const logSuccess = (
  step: string,
  message: string,
  metadata?: Record<string, any>,
) => createDbLog({ step, message, status: "success", metadata });

export const logFailed = (
  step: string,
  message: string,
  metadata?: Record<string, any>,
) => createDbLog({ step, message, status: "failed", metadata });
