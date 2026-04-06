import dotenv from "dotenv";
import { processNewsScraping } from "../src/process.js";

dotenv.config();

(async () => {
  const result = await processNewsScraping();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
})();
