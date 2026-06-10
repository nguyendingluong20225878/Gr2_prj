'use client';

import { useEffect, useState } from 'react';
import type React from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/contexts/AuthContext';
import { CompleteStep } from './components/CompleteStep';
import { ProfileStep, type OnboardingFormData } from './components/ProfileStep';
import { WalletSummaryStep } from './components/WalletSummaryStep';

type OnboardingStep = 'wallet' | 'profile' | 'complete';

const stepOrder: OnboardingStep[] = ['wallet', 'profile', 'complete'];
const stepLabels: Record<OnboardingStep, string> = {
  wallet: 'Ví',
  profile: 'Hồ sơ',
  complete: 'Hoàn tất',
};

export default function OnboardingPage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const { setUser } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('wallet');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<OnboardingFormData>({
    name: '',
    email: '',
    age: '',
    riskTolerance: 'medium',
    tradeStyle: 'swing',
  });

  useEffect(() => {
    if (!connected || !publicKey) router.push('/');
  }, [connected, publicKey, router]);

  useEffect(() => {
    if (currentStep !== 'complete') return;
    const timer = window.setTimeout(() => router.push('/overview'), 900);
    return () => window.clearTimeout(timer);
  }, [currentStep, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!connected || !publicKey) {
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
          notificationEnabled: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể tạo hồ sơ');
      setUser(data);
      setCurrentStep('complete');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo hồ sơ');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!publicKey) return null;

  const walletAddress = publicKey.toBase58();
  const activeStepIndex = stepOrder.indexOf(currentStep);
  const progress = ((activeStepIndex + 1) / stepOrder.length) * 100;

  return (
    <main className="relative flex min-h-dvh items-start justify-center overflow-x-hidden bg-[#0a0118] p-4 py-6 text-white sm:items-center">
      <div className="absolute inset-0 cyber-grid opacity-10" />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/15 via-transparent to-cyan-500/15" />

      <section className="glass-card relative z-10 w-full max-w-3xl rounded-2xl border border-white/10 p-6 shadow-[0_0_40px_rgba(168,85,247,0.16)] md:p-8">
        <div className="text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">Tạo hồ sơ</p>
          <h1 className="text-3xl font-bold gradient-text">Thiết lập danh mục trước khi xem khuyến nghị</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
            NDL chỉ dùng thông tin cơ bản để điều chỉnh cách hiển thị khuyến nghị, không yêu cầu số tiền, thu nhập hoặc tổng tài sản.
          </p>
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-between gap-2">
            {stepOrder.map((step, index) => {
              const isActive = step === currentStep;
              const isDone = index < activeStepIndex;

              return (
                <div key={step} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${
                      isActive || isDone
                        ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200'
                        : 'border-white/10 bg-black/30 text-slate-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className={`max-w-full truncate text-xs font-semibold ${isActive ? 'text-white' : 'text-slate-500'}`}>
                    {stepLabels[step]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="mt-8">
          {currentStep === 'wallet' ? (
            <WalletSummaryStep walletAddress={walletAddress} onContinue={() => setCurrentStep('profile')} />
          ) : currentStep === 'profile' ? (
            <ProfileStep
              formData={formData}
              isSubmitting={isSubmitting}
              onBack={() => setCurrentStep('wallet')}
              onChange={setFormData}
              onSubmit={handleSubmit}
              walletAddress={walletAddress}
            />
          ) : (
            <CompleteStep />
          )}
        </div>
      </section>
    </main>
  );
}
