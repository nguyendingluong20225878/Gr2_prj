'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Loader2, Save, CheckCircle, User as UserIcon, Wallet, Mail, Bell } from 'lucide-react';

export default function ProfilePage() {
  const { user, setUser, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Form State đầy đủ các trường
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    age: '',
    riskTolerance: 'medium',
    tradeStyle: 'swing',
    notificationEnabled: true
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/');
    
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        age: user.age ? String(user.age) : '',
        riskTolerance: user.riskTolerance || 'medium',
        tradeStyle: user.tradeStyle || 'swing',
        notificationEnabled: user.notificationEnabled ?? true
      });
    }
  }, [user, isAuthenticated, isLoading, router]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSuccessMsg('');

    try {
      // Gọi API update. Lưu ý: Đảm bảo route api/user/update hoặc api/user/profile tồn tại và xử lý đúng logic này.
      // Dựa trên code cũ của profile, tôi dùng /api/user/update (PUT) hoặc /api/user/profile (PATCH) tùy vào backend bạn đã setup.
      // Ở đây tôi dùng /api/user/profile cho đồng bộ với giao diện portfolio bạn thích.
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: user.walletAddress, // Khóa chính
          name: formData.name,
          email: formData.email,
          age: Number(formData.age),
          riskTolerance: formData.riskTolerance,
          tradeStyle: formData.tradeStyle,
          notificationEnabled: formData.notificationEnabled
        }),
      });

      const result = await res.json();

      if (!res.ok) throw new Error(result.error || 'Update failed');

      // Update Local Context
      setUser(result.user);
      
      setSuccessMsg('Profile updated successfully!');
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
    <div className="min-h-screen bg-gradient-to-br from-[#0f061e] via-[#1a0b2e] to-[#0f061e] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold gradient-text">Profile Settings</h1>
        
        <div className="glass-card p-8 rounded-xl border border-white/5">
          <div className="space-y-8">
            
            {/* Wallet Section */}
            <div className="p-4 bg-white/5 rounded-lg border border-white/10 flex items-center gap-4">
               <div className="p-3 bg-purple-500/20 rounded-full text-purple-400"><Wallet size={24} /></div>
               <div className="overflow-hidden">
                 <label className="block text-xs text-slate-400 uppercase font-bold mb-1">Connected Wallet</label>
                 <div className="font-mono text-slate-200 text-sm md:text-base truncate">{user.walletAddress}</div>
               </div>
            </div>

            {/* Personal Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Display Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3.5 text-slate-500 w-4 h-4" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none"
                    placeholder="Enter name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 text-slate-500 w-4 h-4" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none"
                    placeholder="name@example.com"
                  />
                </div>
              </div>
              
               <div>
                <label className="block text-sm text-slate-400 mb-2">Age</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none"
                  placeholder="25"
                />
              </div>
            </div>

            {/* Trading Preferences */}
            <div className="border-t border-white/5 pt-6">
              <h2 className="text-xl font-semibold text-white mb-4">Trading Preferences</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Risk Tolerance</label>
                  <select 
                    value={formData.riskTolerance}
                    onChange={(e) => setFormData({...formData, riskTolerance: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="low">Low (Safety First)</option>
                    <option value="medium">Medium (Balanced)</option>
                    <option value="high">High (Degen Mode)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Trading Style</label>
                  <select 
                    value={formData.tradeStyle}
                    onChange={(e) => setFormData({...formData, tradeStyle: e.target.value})}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="scalp">Scalping</option>
                    <option value="day">Day Trading</option>
                    <option value="swing">Swing Trading</option>
                  </select>
                </div>
              </div>
            </div>

             {/* Notifications */}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
               <div className="flex items-center gap-3">
                 <Bell className="text-purple-400" />
                 <div>
                   <p className="text-sm font-bold text-white">Enable Notifications</p>
                   <p className="text-xs text-slate-400">Receive alerts for new AI signals</p>
                 </div>
               </div>
               <input 
                 type="checkbox" 
                 checked={formData.notificationEnabled}
                 onChange={(e) => setFormData({...formData, notificationEnabled: e.target.checked})}
                 className="w-5 h-5 accent-purple-500"
               />
            </div>

            {/* Submit */}
            <div className="pt-4">
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:opacity-90 transition-opacity py-4 rounded-lg font-bold text-white flex justify-center items-center gap-2 shadow-lg shadow-purple-500/20"
              >
                {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                {isSaving ? 'Saving Changes...' : 'Save Profile Settings'}
              </button>
              
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