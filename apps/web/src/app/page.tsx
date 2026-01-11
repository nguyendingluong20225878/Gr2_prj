"use client";
import React from "react";
import { TrendingUp, Activity, DollarSign, Clock, ArrowUpRight } from "lucide-react";
// Đảm bảo đường dẫn import đúng với vị trí file của bạn
import ProposalCard from "./components/ProposalCard"; 

export default function DashboardPage() {
  // Dữ liệu giả lập để test giao diện
  const mockProposals = [
    {
      _id: "1",
      title: "Long SOL - Breakout Entry",
      tokenSymbol: "SOL",
      confidence: 85,
      financialImpact: {
        projectedValue: 150,
        currentValue: 132,
        riskLevel: "Medium",
      },
      expiresAt: new Date(Date.now() + 3600000 * 5), // +5 tiếng
    },
    {
      _id: "2",
      title: "Accumulate JUP",
      tokenSymbol: "JUP",
      confidence: 92,
      financialImpact: {
        projectedValue: 1.2,
        currentValue: 0.9,
        riskLevel: "Low",
      },
      expiresAt: new Date(Date.now() + 3600000 * 12),
    },
    {
      _id: "3",
      title: "Short ETH - Resistance",
      tokenSymbol: "ETH",
      confidence: 65,
      financialImpact: {
        projectedValue: 2800,
        currentValue: 3100,
        riskLevel: "High",
      },
      expiresAt: new Date(Date.now() + 3600000 * 2),
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            NDL Dashboard
          </h1>
          <p className="text-slate-400 mt-2">
            Hệ thống phân tích thị trường Real-time
          </p>
        </div>
        <div className="flex gap-3">
            <div className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                Live System
            </div>
        </div>
      </div>

      {/* 2. Stats Blocks (Các khối thống kê) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                <Activity size={48} className="text-blue-500" />
            </div>
            <div className="text-slate-400 text-sm font-medium mb-1">Active Signals</div>
            <div className="text-3xl font-bold text-white">12</div>
            <div className="text-xs text-green-400 mt-2 flex items-center gap-1">
                <ArrowUpRight size={12} /> +3 new today
            </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                <TrendingUp size={48} className="text-purple-500" />
            </div>
            <div className="text-slate-400 text-sm font-medium mb-1">Win Rate (24h)</div>
            <div className="text-3xl font-bold text-white">78%</div>
            <div className="text-xs text-slate-500 mt-2">Consistent performance</div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/50 border border-white/5 backdrop-blur-sm relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition">
                <DollarSign size={48} className="text-green-500" />
            </div>
            <div className="text-slate-400 text-sm font-medium mb-1">Profit Projected</div>
            <div className="text-3xl font-bold text-green-400">+$1,240</div>
            <div className="text-xs text-slate-500 mt-2">Based on current active signals</div>
        </div>
      </div>

      {/* 3. Main Content: Grid các tín hiệu */}
      <div>
        <div className="flex items-center gap-2 mb-6">
            <Clock className="text-purple-400" size={20} />
            <h2 className="text-xl font-bold text-white">Cơ hội đầu tư mới nhất</h2>
        </div>
        
        {/* Lưới hiển thị các thẻ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockProposals.map((p) => (
             <div key={p._id} className="transform hover:-translate-y-1 transition-transform duration-300">
                <ProposalCard proposal={p} />
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}