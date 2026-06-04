export type FinBERTProbs = {
  pPos: number;
  pNeg: number;
  pNeu: number;
  baseScore: number;
};

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const DEFAULT_PROBS: FinBERTProbs = {
  pPos: 0.33,
  pNeg: 0.33,
  pNeu: 0.34,
  baseScore: 0,
};

function normalizeScoreText(text: string): string {
  const maxChars = Number(process.env.HF_FINBERT_MAX_CHARS ?? 1200);
  const safeMaxChars = Number.isFinite(maxChars) && maxChars > 200
    ? Math.floor(maxChars)
    : 1200;
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, safeMaxChars);
}

// “Lấy ra một mảng arr hợp lệ từ data, dù data có thể là nhiều dạng khác nhau”
function normalizeFinBertResponse(data: any): { pPos: number, pNeg: number, pNeu: number } {
  const arr = Array.isArray(data) && Array.isArray(data[0])
    ? (data[0] as any[])
    : Array.isArray(data)
      ? (data as any[])
      : data && typeof data === "object"
        ? [data]
        : [];

  const byLabel = new Map<string, number>();
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const label = String((item as any).label ?? "").toLowerCase().trim(); // trim: xoa khoang trang dau cuoi
    const score = toNumber((item as any).score);
    if (!label) continue;
    byLabel.set(label, score);
  }
  const pPos = toNumber(byLabel.get("positive"));
  const pNeg = toNumber(byLabel.get("negative"));
  const pNeu = toNumber(byLabel.get("neutral"));

  return { pPos, pNeg, pNeu };
}

function payloadCandidates(text: string): Array<Record<string, unknown>> {
  return [
    { inputs: text, parameters: { top_k: null, truncation: true } },
    { inputs: text, parameters: { return_all_scores: true, truncation: true } },
    { inputs: text },
  ];
}

export async function finBertProbs(text: string, retries = 3): Promise<FinBERTProbs> {
  const HF_TOKEN = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY;
  if (!HF_TOKEN) throw new Error("HF_TOKEN is not set");
  const url = process.env.HF_FINBERT_URL ?? "https://router.huggingface.co/hf-inference/models/ProsusAI/finbert";
  const inputText = normalizeScoreText(text);
  if (!inputText) return DEFAULT_PROBS;
  const payloads = payloadCandidates(inputText);

  for (let i = 0; i < retries; i++) {
    for (const payload of payloads) {
      // Timeout 40 giây cho request FinBERT để tránh treo batch quá lâu.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 40000);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal // Gắn signal để hủy nếu quá 40s
        });

        clearTimeout(timeoutId); // Request thành công thì xóa timeout ngay

        if (res.status === 503 || res.status === 504 || res.status === 502) {
          const waitTime = (i + 1) * 2000;
          console.warn(`[FinBERT] HF Server bận (Status: ${res.status}). Thử lại sau ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          break;
        }

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          if (res.status === 400 && payload !== payloads[payloads.length - 1]) {
            console.warn(`[FinBERT] HF API 400 với payload hiện tại, thử payload fallback. ${body.slice(0, 240)}`);
            continue;
          }
          throw new Error(`HF API Error: ${res.status}${body ? ` - ${body.slice(0, 500)}` : ""}`);
        }

        const data = await res.json();
        const { pPos, pNeg, pNeu } = normalizeFinBertResponse(data);
        return { pPos, pNeg, pNeu, baseScore: pPos - pNeg };

      } catch (error: any) {
        clearTimeout(timeoutId); // Dọn dẹp bộ nhớ
        if (i === retries - 1 && payload === payloads[payloads.length - 1]) {
          console.error(`[FinBERT] Thất bại sau ${retries} lần thử. Lỗi:`, error?.message || error);
          return DEFAULT_PROBS;
        }
        if (payload === payloads[payloads.length - 1]) {
          // Nghỉ 1 chút trước khi retry nếu bị fetch failed
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  }
  return DEFAULT_PROBS;
}
