'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, User, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { CopyButton } from '@/app/components/shared/CopyButton';
import { EmptyState, PageHeader } from '@/app/components/shared/NdlUi';
import { Button } from '@/app/components/ui/button';
import { useAuth } from '@/app/contexts/AuthContext';

type SettingsForm = {
  age: string;
  cryptoInvestmentUsd: string;
  email: string;
  name: string;
  riskTolerance: string;
  totalAssetUsd: string;
  tradeStyle: string;
};

function toInputValue(value?: number | string | null) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function optionalMoneyInputValue(value?: number | string | null) {
  if (value === 0 || value === '0') return '';
  return toInputValue(value);
}

function shortenWallet(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function UserSettings() {
  const router = useRouter();
  const { isLoading, setUser, user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<SettingsForm>({
    age: '',
    cryptoInvestmentUsd: '',
    email: '',
    name: '',
    riskTolerance: 'medium',
    totalAssetUsd: '',
    tradeStyle: 'swing',
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const timer = window.setTimeout(() => router.push('/'), 500);
      return () => window.clearTimeout(timer);
    }

    setFormData({
      age: toInputValue(user.age),
      cryptoInvestmentUsd: optionalMoneyInputValue(user.cryptoInvestmentUsd),
      email: user.email ?? '',
      name: user.name ?? '',
      riskTolerance: user.riskTolerance || 'medium',
      totalAssetUsd: optionalMoneyInputValue(user.totalAssetUsd),
      tradeStyle: user.tradeStyle || 'swing',
    });
  }, [isLoading, router, user]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: formData.age === '' ? undefined : Number(formData.age),
          cryptoInvestmentUsd: formData.cryptoInvestmentUsd === '' ? undefined : Number(formData.cryptoInvestmentUsd),
          email: formData.email,
          name: formData.name,
          riskTolerance: formData.riskTolerance,
          totalAssetUsd: formData.totalAssetUsd === '' ? undefined : Number(formData.totalAssetUsd),
          tradeStyle: formData.tradeStyle,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không thể lưu hồ sơ');
      if (result.user) setUser(result.user);
      toast.success('Đã lưu hồ sơ.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu hồ sơ');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-8 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-300" />
        <p className="mt-3 text-sm text-slate-400">Đang tải hồ sơ...</p>
      </div>
    );
  }

  if (!user) {
    return <EmptyState title="Chưa đăng nhập" description="Vui lòng kết nối ví để xem hồ sơ." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cài đặt"
        title="Hồ sơ cá nhân"
        description="Cập nhật thông tin NDL dùng để cá nhân hóa Portfolio, Signal và cảnh báo rủi ro."
      />

      <section className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyber-purple to-cyber-cyan text-lg font-bold text-white">
              {user.name ? user.name.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-white">{user.name || 'Người dùng NDL'}</p>
              <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
                <Wallet className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                <span className="truncate font-mono">{shortenWallet(user.walletAddress)}</span>
              </div>
            </div>
          </div>
          <CopyButton value={user.walletAddress} label="Sao chép ví" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
          <h2 className="text-lg font-bold text-white">Thông tin cá nhân</h2>
          <div className="mt-4 space-y-4">
            <Field label="Tên" value={formData.name} onChange={(value) => setFormData({ ...formData, name: value })} />
            <Field label="Email" type="email" value={formData.email} onChange={(value) => setFormData({ ...formData, email: value })} />
            <Field label="Tuổi" type="number" value={formData.age} onChange={(value) => setFormData({ ...formData, age: value })} placeholder="Chưa có dữ liệu" />
          </div>
        </div>

        <div className="glass-card rounded-xl border border-white/5 bg-black/20 p-5">
          <h2 className="text-lg font-bold text-white">Khẩu vị đầu tư</h2>
          <div className="mt-4 space-y-4">
            <SelectField
              label="Phong cách giao dịch"
              value={formData.tradeStyle}
              onChange={(value) => setFormData({ ...formData, tradeStyle: value })}
              options={[
                { value: 'scalp', label: 'Scalp' },
                { value: 'swing', label: 'Swing' },
                { value: 'position', label: 'Position' },
              ]}
            />
            <SelectField
              label="Mức chịu rủi ro"
              value={formData.riskTolerance}
              onChange={(value) => setFormData({ ...formData, riskTolerance: value })}
              options={[
                { value: 'low', label: 'Thấp' },
                { value: 'medium', label: 'Trung bình' },
                { value: 'high', label: 'Cao' },
              ]}
            />
            <Field label="Tổng tài sản (USD)" type="number" value={formData.totalAssetUsd} onChange={(value) => setFormData({ ...formData, totalAssetUsd: value })} placeholder="Chưa có dữ liệu" />
            <Field label="Đầu tư crypto (USD)" type="number" value={formData.cryptoInvestmentUsd} onChange={(value) => setFormData({ ...formData, cryptoInvestmentUsd: value })} placeholder="Chưa có dữ liệu" />
          </div>
        </div>
      </section>

      <div className="glass-card flex flex-col gap-3 rounded-xl border border-white/5 bg-black/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">Các giá trị trống sẽ được giữ là thiếu dữ liệu thay vì hiển thị thành 0 trong UI.</p>
        <Button onClick={handleSave} disabled={isSaving} className="h-11 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 font-bold text-white">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Lưu hồ sơ
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none placeholder:text-slate-600 focus:border-purple-500"
      />
    </div>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-300">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/40 p-3 text-white outline-none focus:border-purple-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
