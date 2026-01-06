"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";

interface Log {
  _id: string;
  step: string;
  message: string;
  status: "processing" | "success" | "failed";
  createdAt: string;
  metadata?: Record<string, any>;
}

interface cSignal {
  _id: string;
  tokenAddress: string;
  sentimentType: "positive" | "negative" | "neutral";
  suggestionType: "buy" | "sell" | "hold" | "stake" | "close_position";
  confidence: number;
  ratiocnaleSummary: string;
  detectedAt: string;
  sources: Array<{ label: string; url: string }>;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Dashboard() {
  const { data: logs = [] } = useSWR<Log[]>("/api/logs", fetcher, {
    refreshcInterval: 2000,
  });

  const { data: signals = [] } = usecSWR<Signal[]>("/api/signals", fetcher, {
    refreshInterval: 2000,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "processing":
        return "text-yellow-400";
      case "success":
        return "text-green-400";
      case "failed":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-green-500/20 border-green-500";
      case "negative":
        return "bg-red-500/20 border-red-500";
      case "neutral":
        return "bg-yellow-500/20 border-yellow-500";
      default:
        return "bg-blue-500/20 border-blue-500";
    }
  };

  const getSentimentBadgeColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-green-600 text-green-200";
      case "negative":
        return "bg-red-600 text-red-200";
      case "neutral":
        return "bg-yellow-600 text-yellow-200";
      default:
        return "bg-blue-600 text-blue-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Background animated gradient */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900" />
        <div className="absolute top-0 -left-1/2 w-full h-full bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-transparent blur-3xl" />
        <div className="absolute bottom-0 -right-1/2 w-full h-full bg-gradient-to-l from-purple-600/10 via-blue-600/10 to-transparent blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-blue-500/20 backdrop-blur-md bg-slate-950/50 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">◆</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
                    NDL CORE
                  </h1>
                  <p className="text-xs text-gray-400">AI Transparency Dashboard</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-green-400">Live</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Live Terminal Section (40% - 2/5) */}
            <div className="lg:col-span-2">
              <div className="flex flex-col h-[calc(100vh-200px)]">
                {/* Terminal Header */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                      Live Terminal
                    </h2>
                    <div className="text-xs text-gray-400">
                      {logs.length} events
                    </div>
                  </div>
                  <div className="h-1 bg-gradient-to-r from-blue-500/50 to-purple-500/50 rounded-full" />
                </div>

                {/* Terminal Content */}
                <div className="flex-1 bg-slate-900/40 border border-blue-500/20 rounded-lg overflow-hidden backdrop-blur-md flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1">
                    {logs.length === 0 ? (
                      <div className="text-gray-500 animate-pulse">
                        Waiting for events...
                      </div>
                    ) : (
                      logs.map((log) => (
                        <div
                          key={log._id}
                          className="text-xs text-gray-300 hover:bg-blue-900/20 px-2 py-1 rounded transition-colors"
                        >
                          <span className="text-gray-500">
                            [{new Date(log.createdAt).toLocaleTimeString()}]
                          </span>
                          <span className="text-blue-400 mx-2">{log.step}</span>
                          <span className={getStatusColor(log.status)}>
                            [{log.status.toUpperCase()}]
                          </span>
                          <span className="text-gray-300 ml-2">{log.message}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Terminal Footer */}
                  <div className="border-t border-blue-500/20 bg-slate-950/50 px-4 py-2 text-xs text-gray-500">
                    <span className="text-green-400">▸</span> Ready
                  </div>
                </div>
              </div>
            </div>

            {/* AI Findings Section (60% - 3/5) */}
            <div className="lg:col-span-3">
              <div className="flex flex-col h-[calc(100vh-200px)]">
                {/* Signals Header */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
                      AI Findings
                    </h2>
                    <div className="text-xs text-gray-400">
                      {signals.length} signals
                    </div>
                  </div>
                  <div className="h-1 bg-gradient-to-r from-purple-500/50 to-blue-500/50 rounded-full" />
                </div>

                {/* Signals Grid */}
                <div className="flex-1 overflow-y-auto">
                  {signals.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <p className="text-lg mb-2">No signals detected yet</p>
                        <p className="text-sm">Waiting for AI analysis...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                      {signals.map((signal) => (
                        <div
                          key={signal._id}
                          className={`group relative p-4 border rounded-lg backdrop-blur-md transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/50 ${getSentimentColor(
                            signal.sentimentType
                          )}`}
                        >
                          {/* Glow effect on hover */}
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-lg transition-opacity duration-300" />

                          <div className="relative z-10">
                            {/* Token Address and Sentiment */}
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h3 className="text-lg font-bold text-white mb-1">
                                  {signal.tokenAddress.slice(0, 6)}...
                                  {signal.tokenAddress.slice(-4)}
                                </h3>
                                <span
                                  className={`inline-block px-2 py-1 text-xs font-semibold rounded ${getSentimentBadgeColor(
                                    signal.sentimentType
                                  )}`}
                                >
                                  {signal.sentimentType.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">
                                  {Math.round(signal.confidence * 100)}%
                                </div>
                                <div className="text-xs text-gray-400">Confidence</div>
                              </div>
                            </div>

                            {/* Rationale */}
                            <p className="text-sm text-gray-300 mb-3 line-clamp-3">
                              {signal.rationaleSummary}
                            </p>

                            {/* Suggestion */}
                            <div className="mb-3 pb-3 border-t border-white/10">
                              <p className="text-xs text-gray-400 mt-3 mb-1">
                                Suggested Action
                              </p>
                              <p className="text-sm font-semibold text-white">
                                {signal.suggestionType.toUpperCase()}
                              </p>
                            </div>

                            {/* Time */}
                            <div className="text-xs text-gray-500">
                              {new Date(signal.detectedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
