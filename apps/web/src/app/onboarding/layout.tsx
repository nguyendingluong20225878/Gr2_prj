import React from "react";
// Không cần "use client" ở đây
// import WalletContextProvider... (nếu bạn cần bọc lại, nhưng thường RootLayout đã bọc rồi)

export const metadata = {
  title: "Onboarding - NDL",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
       {/* Thêm chút style để căn giữa nội dung onboarding */}
       <div className="w-full max-w-4xl">
          {children}
       </div>
    </div>
  );
}