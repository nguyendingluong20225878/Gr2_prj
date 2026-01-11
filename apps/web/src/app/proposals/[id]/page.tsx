"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ProposalDetailPage({ params }: { params: { id: string } }) {
  const id = params?.id;
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    fetch(`/api/proposals/${id}`)
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!data || data.error) return <div className="p-6">Proposal not found</div>;

  const projected = data.financialImpact?.projectedValue ?? 0;
  const current = data.financialImpact?.currentValue ?? 1;
  const roi = ((projected - current) / current) * 100;

  const handleExecute = () => {
    const amount = current; // example: buy amount equal to current value
    // Open modal
    setShowModal(true);
    // Mock action
    // eslint-disable-next-line no-console
    console.log("Execute trade", { id: data._id, amount });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <div className="mt-4 text-slate-300">{data.summary}</div>

        <div className="mt-6 p-4 rounded-lg bg-black/40 border border-white/6">
          <div className="mb-4">
            <div className="text-sm text-slate-400">Financial Impact</div>
            <div className="text-xl font-bold text-white">${current.toFixed(2)} → ${projected.toFixed(2)}</div>
            <div className="text-3xl font-extrabold text-green-400 mt-2">{roi.toFixed(2)}%</div>
          </div>

          <div className="mb-4">
            <div className="text-sm text-slate-400">Reasons</div>
            <ul className="list-disc pl-5 mt-2 text-slate-200">
              {(data.reason || []).map((r: string, i: number) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          <div>
            <button onClick={handleExecute} className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold">
              EXECUTE TRADE (${current.toFixed(2)})
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 p-6 rounded-lg">
            <div className="text-white mb-4">Mock Execute</div>
            <div className="text-slate-300 mb-4">ID: {data._id}</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded bg-white/10">Close</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
