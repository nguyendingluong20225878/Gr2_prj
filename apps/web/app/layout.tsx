import type { Metadata } from 'next';
import { WalletContextProvider } from './components/wallet/WalletProvider';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WalletDebug } from './components/wallet/WalletDebug'; // [Mới] Import debug tool
import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';

export const metadata: Metadata = {
  title: 'NDL AI - Crypto Portfolio Manager',
  description: 'AI-powered crypto trading signals on Solana. Social sentiment analysis for smarter trading decisions.',
  keywords: ['crypto', 'solana', 'trading', 'AI', 'portfolio', 'NDL'],
  authors: [{ name: 'NDL AI Team' }],
  openGraph: {
    title: 'NDL AI - Crypto Portfolio Manager',
    description: 'AI-powered crypto trading signals on Solana',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <ErrorBoundary>
          <WalletContextProvider>
            <AuthProvider>
              <div className="dark min-h-screen bg-background font-sans antialiased">
                {children}
                
                {/* [Mới] Thêm bảng Debug vào đây để nó luôn hiển thị trên mọi trang */}
                <WalletDebug />
                
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
        </ErrorBoundary>
      </body>
    </html>
  );
}