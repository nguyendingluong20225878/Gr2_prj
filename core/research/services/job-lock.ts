//Ngăn chặn tình trạng nhiều tiến trình cùng thực thi 1 công việc tại cùng 1 thời điểm
import { mongoose } from "../../shared/src/index.js";

type JobLockDocument = {
  _id: string;
  owner?: string;
  lockedAt?: Date;
  releasedAt?: Date | null;
  ttlMs?: number;//time-to-live 
};

//Hàm chiếm quyền khóa
export async function acquireJobLock(lockId: string, ttlMs: number): Promise<string | null> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");

  //Cbi thông tin
  const now = new Date();
  const staleBefore = new Date(now.getTime() - ttlMs);//thời điểm quá hạn
  const owner = `${process.pid}:${lockId}:${now.toISOString()}`;
  const locks = db.collection<JobLockDocument>("job_locks");
  const result = await locks.findOneAndUpdate(
    {
      _id: lockId,
      $or: [
        { lockedAt: { $lte: staleBefore } },
        { lockedAt: { $exists: false } },
        { releasedAt: { $ne: null } },
      ],
    },
    {
      $set: {
        owner,
        lockedAt: now,
        releasedAt: null,
        ttlMs,
      },
    },
    { returnDocument: "after" }
  );

  if (result?.owner === owner) return owner;

  try {
    await locks.insertOne({
      _id: lockId,
      owner,
      lockedAt: now,
      releasedAt: null,
      ttlMs,
    });
    return owner;
  } catch {
    return null;
  }
}

export async function releaseJobLock(lockId: string, owner: string): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;
  await db.collection<JobLockDocument>("job_locks").updateOne(
    { _id: lockId, owner },
    { $set: { releasedAt: new Date() } }
  );
}
