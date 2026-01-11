"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import WalletStep from "./components/wallet-step";
import ProfileStep from "./components/profile-step";

export default function Page() {
  const [step, setStep] = useState<number>(1);
  const router = useRouter();

  const handleRedirect = () => {
    router.push("/");
  };

  return (
    <main>
      {step === 1 && <WalletStep onNext={() => setStep(2)} />}
      {step === 2 && <ProfileStep onFinish={handleRedirect} />}
    </main>
  );
}
