'use client';

import type React from 'react';
import { ArrowRight, Loader2, Wallet } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

export type OnboardingFormData = {
  name: string;
  email: string;
  age: string;
  riskTolerance: string;
  tradeStyle: string;
};

export function ProfileStep({
  formData,
  isSubmitting,
  onBack,
  onChange,
  onSubmit,
  walletAddress,
}: {
  formData: OnboardingFormData;
  isSubmitting: boolean;
  onBack: () => void;
  onChange: (nextFormData: OnboardingFormData) => void;
  onSubmit: (event: React.FormEvent) => void;
  walletAddress: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3 font-mono text-xs text-slate-400">
        <Wallet className="h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">{walletAddress}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Tên" value={formData.name} onChange={(value) => onChange({ ...formData, name: value })} required />
        <Field label="Email" type="email" value={formData.email} onChange={(value) => onChange({ ...formData, email: value })} required />
        <Field label="Tuổi" type="number" value={formData.age} onChange={(value) => onChange({ ...formData, age: value })} required />
        <SelectField
          label="Phong cách theo dõi"
          value={formData.tradeStyle}
          onChange={(value) => onChange({ ...formData, tradeStyle: value })}
          options={[
            { value: 'scalp', label: 'Theo dõi hằng ngày' },
            { value: 'swing', label: 'Khi có thay đổi đáng chú ý' },
            { value: 'position', label: 'Chỉ khi có rủi ro lớn' },
          ]}
        />
      </div>

      <SelectField
        label="Khẩu vị rủi ro"
        value={formData.riskTolerance}
        onChange={(value) => onChange({ ...formData, riskTolerance: value })}
        options={[
          { value: 'low', label: 'Thấp' },
          { value: 'medium', label: 'Trung bình' },
          { value: 'high', label: 'Cao' },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting} className="h-12 border-white/10 text-slate-300">
          Quay lại
        </Button>
        <Button type="submit" disabled={isSubmitting} className="h-12 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 font-bold text-white">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          Tạo hồ sơ
        </Button>
      </div>
    </form>
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
