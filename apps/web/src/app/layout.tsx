import React from "react";
import WalletContextProvider from "../components/providers/WalletContextProvider";
import Navbar from "./components/Navbar"; 
import "./globals.css"; // Đảm bảo import CSS

export const metadata = {
  title: "NDL",
  description: "Quản trị tài sản Crypto thông minh trên Solana",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Thêm suppressHydrationWarning vào đây
    <html lang="vi" suppressHydrationWarning>
      <body className="bg-slate-950 text-white min-h-screen flex flex-col font-sans selection:bg-purple-500/30">
        <WalletContextProvider>
          {/* Thêm Navbar vào để hiển thị xuyên suốt */}
          <Navbar />
          <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6">
            {children}
          </main>
        </WalletContextProvider>
      </body>
    </html>
  );
}