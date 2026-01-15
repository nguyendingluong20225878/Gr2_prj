'use client';

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f061e] via-[#1a0b2e] to-[#0f061e] flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="glass-card p-8 rounded-xl">
          <h1 className="text-4xl font-bold gradient-text mb-4">Welcome to NDL AI</h1>
          <p className="text-slate-300 mb-8">
            Let's set up your profile to get personalized trading signals
          </p>
          
          <div className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Email</label>
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                className="w-full bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Risk Tolerance */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Risk Tolerance</label>
              <select className="w-full bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none transition-colors">
                <option>Low - Conservative</option>
                <option>Medium - Balanced</option>
                <option>High - Aggressive</option>
              </select>
            </div>

            {/* Trading Style */}
            <div>
              <label className="block text-sm text-slate-400 mb-2">Trading Style</label>
              <select className="w-full bg-slate-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-slate-200 focus:border-purple-500 focus:outline-none transition-colors">
                <option>Day Trading</option>
                <option>Swing Trading</option>
                <option>Position Trading</option>
                <option>HODLing</option>
              </select>
            </div>

            <button className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:opacity-90 transition-opacity py-4 rounded-lg font-semibold text-white">
              Complete Setup
            </button>
          </div>

          <div className="mt-8 p-6 glass-card rounded-lg">
            <h2 className="text-xl font-semibold mb-4 text-slate-200">
              📝 Migration Status
            </h2>
            <p className="text-slate-300 mb-4">
              Onboarding form needs to be migrated from <code className="bg-slate-800 px-2 py-1 rounded">/src/app/components/onboarding/OnboardingForm.tsx</code>
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
