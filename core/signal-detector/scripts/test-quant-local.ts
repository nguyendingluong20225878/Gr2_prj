import dotenv from "dotenv";
dotenv.config();

import { detectSignalWithFinBertQuant } from "../src/detector";

(async () => {
  const formattedTweets = [
    {
      id: "1",
      text: "SOL looks very strong, bullish momentum today.",
      author: "a1",
      time: new Date().toISOString(),
      url: "https://x.com/a1/status/1",
      likeCount: 120,
      retweetCount: 20,
      replyCount: 10,
      authorWeight: 1.3,
    },
    {
      id: "2",
      text: "I am bearish on SOL this week.",
      author: "a2",
      time: new Date().toISOString(),
      url: "https://x.com/a2/status/2",
      likeCount: 15,
      retweetCount: 3,
      replyCount: 2,
      authorWeight: 1.0,
    },
  ];

  const knownTokens = [
    { address: "So11111111111111111111111111111111111111112", symbol: "SOL", name: "Solana" },
  ];

  const result = await detectSignalWithFinBertQuant({ formattedTweets, knownTokens });
  console.dir(result, { depth: null });
})();