import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx}", // nếu có
  ],
  theme: {
    extend: {
      colors: {
        background: "#020617",
        surface: "rgba(30, 41, 59, 0.5)",
      },
      backgroundImage: {
        'ndl-gradient': 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
