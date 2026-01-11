"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function Navbar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  // Hiệu ứng đổi màu nền khi cuộn trang
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Dashboard", href: "/" },
    { name: "Onboarding", href: "/onboarding" },
    { name: "Signals", href: "/signals" }, // Ví dụ thêm trang
  ];

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 border-b ${
        isScrolled
          ? "bg-slate-950/80 backdrop-blur-md border-white/10 py-3"
          : "bg-transparent border-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg group-hover:shadow-blue-500/50 transition">
            <span className="font-bold text-white text-xs">AI</span>
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            NDL
          </span>
        </Link>

        {/* Navigation Desktop */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? "text-blue-400"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Wallet Button */}
        <div className="flex items-center gap-4">
          {/* Custom style cho nút ví để hợp theme */}
          <div className="wallet-adapter-button-trigger">
            <WalletMultiButton style={{ 
                backgroundColor: 'rgba(59, 130, 246, 0.2)', 
                height: '40px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                border: '1px solid rgba(255,255,255,0.1)'
            }} />
          </div>
        </div>
      </div>
    </header>
  );
}