'use client';

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f061e] via-[#1a0b2e] to-[#0f061e] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="glass-card p-8 rounded-xl">
          <h1 className="text-4xl font-bold gradient-text mb-4">Profile Settings</h1>
          <p className="text-slate-300 mb-8">
            Manage your account and trading preferences
          </p>
          
          <div className="space-y-8">
            {/* Personal Information */}
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-slate-200">Personal Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Wallet Address</label>
                  <div className="bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-400 font-mono text-sm">
                    DevWallet123456789
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Email</label>
                  <input
                    type="email"
                    defaultValue="dev@ndl.ai"
                    className="w-full bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Full Name</label>
                  <input
                    type="text"
                    defaultValue="Dev User"
                    className="w-full bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Trading Preferences */}
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-slate-200">Trading Preferences</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Risk Tolerance</label>
                  <select 
                    defaultValue="medium"
                    className="w-full bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none transition-colors"
                  >
                    <option value="low">Low - Conservative</option>
                    <option value="medium">Medium - Balanced</option>
                    <option value="high">High - Aggressive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-2">Trading Style</label>
                  <select 
                    defaultValue="swing"
                    className="w-full bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none transition-colors"
                  >
                    <option value="day">Day Trading</option>
                    <option value="swing">Swing Trading</option>
                    <option value="position">Position Trading</option>
                    <option value="hodl">HODLing</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div>
              <h2 className="text-2xl font-semibold mb-4 text-slate-200">Notifications</h2>
              <div className="flex items-center justify-between p-4 glass-card rounded-lg">
                <div>
                  <div className="font-semibold text-slate-200">Email Notifications</div>
                  <div className="text-sm text-slate-400">Receive trading signal alerts</div>
                </div>
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded bg-slate-900 border-purple-500/30" />
              </div>
            </div>

            <button className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:opacity-90 transition-opacity py-4 rounded-lg font-semibold text-white">
              Save Changes
            </button>
          </div>

          <div className="mt-8 p-6 glass-card rounded-lg">
            <h2 className="text-xl font-semibold mb-4 text-slate-200">
              📝 Migration Status
            </h2>
            <p className="text-slate-300 mb-4">
              Profile components need to be migrated from <code className="bg-slate-800 px-2 py-1 rounded">/src/app/components/profile/ProfileSettings.tsx</code>
            </p>
            <p className="text-slate-400 text-sm">
              See <code className="bg-slate-800 px-2 py-1 rounded">MIGRATION_COMPLETE.md</code> for details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
