import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
 // Kích hoạt dark mode bằng class
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}", // Thêm src nếu dùng cấu trúc cũ
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        // Thêm các màu Cyberpunk custom từ globals.css
        cyber: {
          purple: "var(--cyber-purple)",
          "purple-dark": "var(--cyber-purple-dark)",
          cyan: "var(--cyber-cyan)",
          "cyan-light": "var(--cyber-cyan-light)",
          pink: "var(--cyber-pink)",
          blue: "var(--cyber-blue)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'ndl-gradient': 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)', // Cập nhật màu gradient chính xác
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'scan': 'scan 3s ease-in-out infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")], // Cần cài thêm: npm i tailwindcss-animate
};

export default config;