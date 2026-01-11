"use client";
import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type Props = {
  onFinish?: () => void;
};

export default function ProfileStep({ onFinish }: Props) {
  const { publicKey } = useWallet();
  const [risk, setRisk] = useState<number>(50);
  const [styles, setStyles] = useState<string[]>([]);
  const [budget, setBudget] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleStyle = (s: string) => {
    setStyles((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const riskLabel = () => {
    if (risk <= 33) return "Conservative";
    if (risk <= 66) return "Balanced";
    return "Degen";
  };

  const riskColor = () => {
    if (risk <= 33) return "from-blue-500 to-blue-600";
    if (risk <= 66) return "from-blue-600 to-purple-600";
    return "from-orange-500 to-red-500";
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const wallet = publicKey ? publicKey.toBase58() : null;
    const payload = { wallet, risk: riskLabel(), styles, budget: Number(budget || 0) };
    await new Promise((r) => setTimeout(r, 2000));
    // Mock API call
    // eslint-disable-next-line no-console
    console.log("[Mock API] Creating User:", payload);
    setIsSubmitting(false);
    onFinish?.();
  };

  return (
    <section className="max-w-3xl mx-auto p-6">
      <div className="p-6 rounded-2xl bg-black/40 backdrop-blur-md border border-white/6">
        <h2 className="text-2xl font-bold text-white">Cấu hình AI Persona</h2>
        <p className="text-slate-300 mt-2">Giúp NDL AI hiểu phong cách đầu tư của bạn.</p>

        <div className="mt-6 space-y-6">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Khẩu vị Rủi ro</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={100}
                value={risk}
                onChange={(e) => setRisk(Number(e.target.value))}
                className="w-full accent-transparent"
                style={{
                  background: `linear-gradient(90deg, ${risk <= 33 ? "#3b82f6" : risk <= 66 ? "#6366f1" : "#fb923c"} 0%, #111827 100%)`,
                }}
              />
              <div className="w-36 text-sm text-slate-200">{riskLabel()}</div>
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>Conservative</span>
              <span>Balanced</span>
              <span>Degen</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Hệ sinh thái quan tâm</label>
            <div className="flex gap-3 flex-wrap">
              {["Solana Eco", "Meme Coins", "Blue Chips", "DeFi"].map((s) => {
                const active = styles.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStyle(s)}
                    className={`px-3 py-1 rounded-md text-sm ${active ? "border-2 border-blue-400 text-white" : "border border-white/10 text-slate-300"} bg-black/30 backdrop-blur-sm`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Vốn dành cho Bot ($)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="1000"
              className="w-full p-3 rounded-lg bg-black/30 border border-white/6 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold shadow-lg disabled:opacity-60"
          >
            {isSubmitting ? "Initializing..." : "Initialize NDL AI"}
          </button>
        </div>
      </div>
    </section>
  );
}
