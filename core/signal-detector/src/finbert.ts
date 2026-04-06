export type FinBERTProbs = {
    pPos: number;
    pNeg: number;
    pNeu: number;
    baseScore: number;
  
  };
  
  function toNumber( v: unknown) : number {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  
  //“Lấy ra một mảng arr hợp lệ từ data, dù data có thể là nhiều dạng khác nhau”
  function normalizeFinBertResponse( data : any) : { pPos: number, pNeg: number, pNeu: number } {
    const arr = Array.isArray(data) && Array.isArray(data[0])
    ? (data[0] as any[])
    :Array.isArray(data) ? (data as any[]) : [];
  
    const byLabel = new Map<string, number>();
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const label = String((item as any).label ?? "").toLowerCase().trim();//trim : xoa khoang trang dau cuoi
      const score = toNumber((item as any).score);
      if (!label) continue;
      byLabel.set(label, score);
    }
    const pPos = toNumber(byLabel.get("positive"));
    const pNeg = toNumber(byLabel.get("negative"));
    const pNeu = toNumber(byLabel.get("neutral"));
  
    return { pPos, pNeg, pNeu };
  }
  
  export async function finBertProbs(text: string): Promise<FinBERTProbs> {
    const HF_TOKEN = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY;
    if(!HF_TOKEN) throw new Error("HF_TOKEN is not set");
    const url =
      process.env.HF_FINBERT_URL ??
      "https://router.huggingface.co/hf-inference/models/ProsusAI/finbert";
    const res = await fetch(url,{
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        inputs: text,
        parameters: {return_all_scores:true},
       }),
    });
    if (!res.ok) {
      const textBody = await res.text().catch(() => "");
      throw new Error(
        `FinBERT HF request failed: ${res.status} ${res.statusText}${textBody ? ` - ${textBody}` : ""}`
      );
    }
  
    const data = await res.json();
    const { pPos, pNeg, pNeu } = normalizeFinBertResponse(data);
    const baseScore = pPos - pNeg;
  
    return { pPos, pNeg, pNeu, baseScore };
  }
  