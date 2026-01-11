import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WalletContextProvider } from './components/wallet/WalletProvider';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './components/dashboard/Dashboard';
import { ProposalDetailSocial } from './components/proposal/ProposalDetailSocial';
import { Portfolio } from './components/portfolio/Portfolio';
import { LandingPage } from './components/landing/LandingPage';
import { OnboardingForm } from './components/onboarding/OnboardingForm';
import { ProfileSettings } from './components/profile/ProfileSettings';
import { Toaster } from './components/ui/sonner';
import { setupMockApi } from './services/mockApi';
import { useEffect } from 'react';

export default function App() {
  // Setup mock API on mount
  useEffect(() => {
    setupMockApi();
  }, []);

  return (
    <Router>
      <WalletContextProvider>
        <AuthProvider>
          <div className="dark">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/onboarding" element={<OnboardingForm />} />
              
              {/* Protected Routes with Layout */}
              <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
              <Route path="/proposal/:id" element={<Layout><ProposalDetailSocial /></Layout>} />
              <Route path="/portfolio" element={<Layout><Portfolio /></Layout>} />
              <Route path="/profile" element={<Layout><ProfileSettings /></Layout>} />
            </Routes>
            <Toaster 
              position="top-right"
              toastOptions={{
                style: {
                  background: 'rgba(15, 6, 30, 0.95)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  color: '#f8fafc',
                },
              }}
            />
          </div>
        </AuthProvider>
      </WalletContextProvider>
    </Router>
  );
}