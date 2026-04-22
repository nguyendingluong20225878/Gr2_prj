import { weightedAvg } from "./stats";
import { PreScoredNewsEvidence } from "./types";

export type TokenRef = { symbol: string; coingeckoId: string | null };

/**
 * Bộ gom nhóm Tin tức (News Aggregator)
 * Chỉ nhận dữ liệu ĐÃ ĐƯỢC CHẤM ĐIỂM (Pre-scored) từ Orchestrator
 * Thực hiện gom nhóm theo token và tính toán trung bình có trọng số.
 */
export function aggregateNewsByToken(evidenceList: PreScoredNewsEvidence[]) {
  // Map lưu kết quả: Key là tokenKey, Value là điểm số và top tin bài
  const byToken = new Map<string, { newsScore: number; nArticles: number; topUrls: string[] }>();
  
  if (!evidenceList.length) return byToken;

  // 1. Gom nhóm theo tokenKey
  const grouped = new Map<string, PreScoredNewsEvidence[]>();
  for (const ev of evidenceList) {
    const arr = grouped.get(ev.tokenKey) ?? [];
    arr.push(ev);
    grouped.set(ev.tokenKey, arr);
  }

  // 2. Tính toán điểm trung bình có trọng số (Weighted Average)
  for (const [tokenKey, arr] of grouped.entries()) {
    const score = weightedAvg(
      arr.map((x) => x.zScore),
      arr.map((x) => x.finalWeight)
    );
    
    // Sắp xếp lấy Top 5 bài báo có lực tác động mạnh nhất (Cả âm và dương)
    // bằng cách so sánh trị tuyệt đối của Z-Score
    const topUrls = [...arr]
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
      .slice(0, 5)
      .map((x) => x.articleUrl);

    byToken.set(tokenKey, { newsScore: score, nArticles: arr.length, topUrls });
  }

  return byToken;
}