import { weightedAvg } from "./stats";

export type PreScoredEvidence = {
  tweetId: string;
  tokenKey: string;
  zScore: number;      // Đã chuẩn hóa qua hàm zscores chống nhiễu
  finalWeight: number; // Đã nhân authorWeight * engagementMultiplier
  url?: string;
};

/**
 * Gom nhóm các tweet đã được chấm điểm (Pre-scored) theo từng Token
 */
export function aggregateTwitterSignals(evidenceList: PreScoredEvidence[]) {
  const byTokenKey = new Map<string, { twitterScore: number; nTweets: number; topTweetIds: string[] }>();
  
  if (!evidenceList.length) return { byTokenKey, evidenceCount: 0 };

  // 1. Group theo TokenKey
  const grouped = new Map<string, PreScoredEvidence[]>();
  for (const ev of evidenceList) {
    const arr = grouped.get(ev.tokenKey) ?? [];
    arr.push(ev);
    grouped.set(ev.tokenKey, arr);
  }

  // 2. Aggregate (Chỉ dùng Toán học để lấy trung bình có trọng số)
  for (const [tokenKey, arr] of grouped.entries()) {
    const score = weightedAvg(
      arr.map((x) => x.zScore),
      arr.map((x) => x.finalWeight)
    );
    
    // Lấy top 5 tweets có Z-score tuyệt đối cao nhất làm Bằng chứng (Evidence)
    const topTweetIds = [...arr]
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
      .slice(0, 5)
      .map(x => x.tweetId);
    
    byTokenKey.set(tokenKey, { twitterScore: score, nTweets: arr.length, topTweetIds });
  }

  return { byTokenKey, evidenceCount: evidenceList.length };
}

// Ghi chú: Nếu hệ thống bạn có News, bạn sẽ viết thêm 1 hàm mergeNewsAndTwitter ở đây,
// nhưng nguyên tắc vẫn là truyền vào Data đã được tính điểm sẵn.