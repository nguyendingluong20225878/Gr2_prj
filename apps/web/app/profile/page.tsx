'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, Save, CheckCircle } from 'lucide-react';

export default function ProfilePage() {
  const { user, setUser, isAuthenticated, isLoading } = useAuth(); // Lấy hàm setUser
  const router = useRouter();
  
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    riskTolerance: 'medium',
    tradeStyle: 'swing',
    notificationEnabled: true
  });

  // Load data từ user context vào form
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/');
    
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        riskTolerance: user.riskTolerance || 'medium',
        tradeStyle: user.tradeStyle || 'swing',
        notificationEnabled: user.notificationEnabled ?? true
      });
    }
  }, [user, isAuthenticated, isLoading, router]);

  // HÀM UPDATE QUAN TRỌNG
  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSuccessMsg('');

    try {
      // 1. Gọi API Update
      const res = await fetch('/api/user/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: user.walletAddress, // Dùng làm khóa tìm kiếm
          ...formData
        }),
      });

      const updatedUser = await res.json();

      if (!res.ok) throw new Error(updatedUser.error);

      // 2. CẬP NHẬT UI NGAY LẬP TỨC
      // Hàm setUser sẽ update state trong Context -> React sẽ re-render lại UI
      setUser(updatedUser);
      
      setSuccessMsg('Profile updated successfully!');
      
      // Tắt thông báo sau 3s
      setTimeout(() => setSuccessMsg(''), 3000);

    } catch (error) {
      console.error("Update failed:", error);
      alert("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !user) return <div className="min-h-screen bg-[#0f061e] flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f061e] via-[#1a0b2e] to-[#0f061e] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="glass-card p-8 rounded-xl">
          <h1 className="text-4xl font-bold gradient-text mb-8">Profile Settings</h1>
          
          <div className="space-y-8">
            {/* Personal Information */}
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-slate-200">Personal Information</h2>
              <div className="space-y-4">
                
                {/* Wallet (Read-only) */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Wallet Address</label>
                  <div className="bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-400 font-mono text-sm">
                    {user.walletAddress}
                  </div>
                </div>

                {/* Email Update */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none"
                    placeholder="Enter your email"
                  />
                </div>

                {/* Name Update */}
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none"
                    placeholder="Enter your display name"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:opacity-90 transition-opacity py-4 rounded-lg font-semibold text-white flex justify-center items-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                {isSaving ? 'Saving Changes...' : 'Save Profile'}
              </button>
              
              {/* Success Message */}
              {successMsg && (
                <div className="mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-2 text-green-400 justify-center animate-in fade-in slide-in-from-bottom-2">
                  <CheckCircle size={18} />
                  {successMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}