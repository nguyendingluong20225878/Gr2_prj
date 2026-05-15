import dotenv from 'dotenv';
import { detectSignalWithFinBertQuant } from '../src/quant-engine.js';

dotenv.config();

async function runTest() {
  console.log("🧪 --- BẮT ĐẦU TEST LOGIC QUANT V3 ---");

  const mockTokens = [
    { symbol: 'BTC', name: 'Bitcoin', address: 'native' },
    { symbol: 'ETH', name: 'Ethereum', address: '0x123' }
  ];

  const mockHistory = {
    'BTC': [
      { unifiedRaw: 0.15, timestamp: Date.now() - 4 * 86400000 },
      { unifiedRaw: 0.08, timestamp: Date.now() - 3 * 86400000 },
      { unifiedRaw: 0.12, timestamp: Date.now() - 2 * 86400000 },
      { unifiedRaw: 0.05, timestamp: Date.now() - 1 * 86400000 },
    ],
    'ETH': [
      { unifiedRaw: 5.0, timestamp: Date.now() - 1 * 86400000 }
    ]
  };

  // [FIX TS]: Bổ sung đầy đủ các trường bắt buộc cho FormattedNews
  const mockNews = [
    {
      docType: 'news' as const,
      title: "BREAKING: Bitcoin adoption hits 100% in all countries!",
      summary: "Positive news everywhere for BTC.",
      content: "Full content detailing the massive global adoption of Bitcoin...", // Đã thêm
      articleUrl: "https://mock-news.com/btc-adoption", // Đã thêm
      siteUrl: "https://mock-news.com", // Đã thêm
      detectedTokens: ["BTC"],
      publishedAt: new Date(),
      scrapedAt: new Date()// Đã thêm
    }
  ];

  console.log("⏳ Đang tính toán...");
  
  const results = await detectSignalWithFinBertQuant({
    formattedNews: mockNews,
    formattedTweets: [],
    knownTokens: mockTokens,
    historicalData: mockHistory
  });

  console.log("\n--- KẾT QUẢ PHÂN TÍCH ---");
  console.dir(results, { depth: null, colors: true });
  
  // [FIX TS]: Định nghĩa r: any để bỏ qua giới hạn của Partial<QuantSignalResponse>
  results.forEach((r: any) => {
    const symbol = r.tokenSymbol || "UNKNOWN";
    
    // 💡 [SỬA Ở ĐÂY]: Không còn finalScore hay directionScore nữa
    // Engine trả thẳng quantScore cho bạn!
    const zScore = r.quantScore; 
    
    const suggestion = r.suggestionType || "hold";
    const conf = r.confidence || 0;

    console.log(`Token: ${symbol}`);
    // Điểm AI thô đã bị Engine giấu đi bên trong quá trình xử lý, 
    // chúng ta chỉ in Điểm Z-Score cuối cùng ra thôi
    console.log(`- Điểm cuối (Z-Score): ${zScore ? zScore.toFixed(4) : 'N/A'}`);
    console.log(`- Gợi ý: ${suggestion.toUpperCase()}`);
    console.log(`- Độ tự tin: ${(conf * 100).toFixed(2)}%`);
    
    if (symbol === 'ETH' && suggestion === 'hold') {
      console.log("✅ Thành công: ETH bị Hold vì thiếu lịch sử (N < 3).");
    }
    if (symbol === 'BTC' && zScore > 0) {
      console.log("✅ Thành công: BTC có Alpha dương vì hôm nay tốt hơn lịch sử.");
    }
  });
}

runTest().catch(console.error);