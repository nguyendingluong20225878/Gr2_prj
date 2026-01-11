"use client";
import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Brain } from "lucide-react";
import { useRouter } from "next/navigation";

function shortenAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

type Props = {
  onNext?: () => void;
};

export default function WalletStep({ onNext }: Props) {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const router = useRouter();

  const handleConnect = () => {
    setVisible(true);
  };

  const handleContinue = () => {
    if (onNext) {
      onNext();
    } else {
      router.push("/");
    }
  };

  return (
    <section className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center text-center">
        <div className="p-6 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 shadow-neon">
          <div className="p-3 rounded-full bg-black/30 backdrop-blur-md border border-white/10">
            <Brain className="w-14 h-14 text-white drop-shadow-[0_0_10px_rgba(99,102,241,0.9)]" />
          </div>
        </div>

        <h1 className="mt-6 text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-blue-400 to-purple-300">
          Welcome to NDL
        </h1>

        <p className="mt-3 text-slate-300 max-w-xl">
          Hệ thống quản trị tài sản Crypto thông minh. Kết nối ví Phantom để bắt đầu.
        </p>
      </div>

      <div className="w-full flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="p-6 rounded-2xl bg-black/40 backdrop-blur-md border border-white/6">
            <div className="mb-4">
              {connected && publicKey ? (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-400">Connected Wallet</div>
                    <div className="mt-1 font-mono text-sm text-white">{shortenAddress(publicKey.toBase58())}</div>
                  </div>
                  <button
                    onClick={handleContinue}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold shadow-lg hover:scale-[1.01] transition-transform"
                  >
                    Continue to Setup
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="text-sm text-slate-400">No wallet connected</div>
                  <button
                    onClick={handleConnect}
                    className="inline-flex items-center justify-center gap-3 w-full px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold shadow-[0_10px_30px_rgba(99,102,241,0.2)] hover:brightness-105 transition"
                  >
                    <span className="text-lg">Connect Phantom Wallet</span>
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 text-xs text-slate-500">Supported wallet: Phantom (recommended)</div>
          </div>
        </div>
      </div>
    </section>
  );
}
