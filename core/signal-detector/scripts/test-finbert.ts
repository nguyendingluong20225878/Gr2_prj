import dotenv from "dotenv";
dotenv.config();

import { finBertProbs } from "../src/finbert";

(async () => {
  const text = "Bitcoin shows strong momentum and market sentiment is improving.";
  const r = await finBertProbs(text);
  console.log(r); // expect: { pPos, pNeg, pNeu, baseScore }
})();