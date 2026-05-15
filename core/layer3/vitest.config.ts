import dotenv from "dotenv";
import { defineConfig } from "vitest/config.js";

export default defineConfig({
  test: {
    env: dotenv.config({ path: ".env" }).parsed,
    globals: true,
  },
});
