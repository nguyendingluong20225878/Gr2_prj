'use client';

import { useEffect, useState } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowRight, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { useAuth } from '@/app/contexts/AuthContext';

export default function OnboardingPage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const { setUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    riskTolerance: 'medium',
    tradeStyle: 'swing',
    totalAssetUsd: '',
    cryptoInvestmentUsd: '',
  });

  useEffect(() => {
    if (!connected && !publicKey) router.push('/');
  }, [connected, publicKey, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!publicKey) {
      toast.error('Vui lòng kết nối ví trước.');
      return;
    }
    if (!formData.email || !formData.age || !formData.name) {
      toast.error('Vui lòng nhập tên, email và tuổi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/user/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          age: Number(formData.age),
          riskTolerance: formData.riskTolerance,
          tradeStyle: formData.tradeStyle,
          totalAssetUsd: Number(formData.totalAssetUsd || 0),
          cryptoInvestmentUsd: Number(formData.cryptoInvestmentUsd || 0),
          notificationEnabled: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể tạo hồ sơ');
      setUser(data);
      router.push('/overview');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo hồ sơ');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!publicKey) return null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0118] p-4 text-white">
      <section className="glass-card w-full max-w-2xl rounded-2xl border border-white/10 p-8">
        <p className="mb-2 text-center text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Tạo hồ sơ</p>
        <h1 className="text-center text-3xl font-bold gradient-text">Thiết lập Portfolio trước khi xem Signal</h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-400">
          NDL dùng thông tin này để cá nhân hóa khuyến nghị giao dịch và cảnh báo rủi ro.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3 font-mono text-xs text-slate-400">
            <Wallet className="h-4 w-4" />
            <span className="truncate">{publicKey.toBase58()}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tên" value={formData.name} onChange={(value) => setFormData({ ...formData, name: value })} required />
            <Field label="Email" type="email" value={formData.email} onChange={(value) => setFormData({ ...formData, email: value })} required />
            <Field label="Tuổi" type="number" value={formData.age} onChange={(value) => setFormData({ ...formData, age: value })} required />
            <Field label="Tổng tài sản (USD)" type="number" value={formData.totalAssetUsd} onChange={(value) => setFormData({ ...formData, totalAssetUsd: value })} />
            <Field label="Số tiền đầu tư crypto (USD)" type="number" value={formData.cryptoInvestmentUsd} onChange={(value) => setFormData({ ...formData, cryptoInvestmentUsd: value })} />
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Phong cách giao dịch</label>
              <select
                value={formData.tradeStyle}
                onChange={(event) => setFormData({ ...formData, tradeStyle: event.target.value })}
                className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none focus:border-purple-500"
              >
                <option value="scalp">Scalp</option>
                <option value="swing">Swing</option>
                <option value="position">Position</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Mức chịu rủi ro</label>
            <select
              value={formData.riskTolerance}
              onChange={(event) => setFormData({ ...formData, riskTolerance: event.target.value })}
              className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none focus:border-purple-500"
            >
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
            </select>
          </div>

          <Button type="submit" disabled={isSubmitting} className="h-12 w-full rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 font-bold text-white">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Tạo hồ sơ
          </Button>
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">
        {label} {required ? <span className="text-red-400">*</span> : null}
      </label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none focus:border-purple-500"
      />
    </div>
  );
}
