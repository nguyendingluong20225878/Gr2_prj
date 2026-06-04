import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // [Mới] Import font chuẩn để tránh lỗi font
import { WalletContextProvider } from './components/wallet/WalletProvider';
import { AuthProvider } from './contexts/AuthContext';
import { TradingDemoProvider } from './contexts/TradingDemoContext';
import { Toaster } from './components/ui/sonner';
import { ErrorBoundary } from './components/ErrorBoundary';
import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';

// Cấu hình Font Inter
const inter = Inter({ subsets: ['latin'] });
const showDebugPanel = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENABLE_DEBUG_PANEL === 'true';

export const metadata: Metadata = {
  title: 'NDL - Solana DeFi Dashboard',
  description: 'Bảng điều khiển Portfolio, Signal và khuyến nghị giao dịch Solana DeFi.',
  keywords: ['crypto', 'solana', 'trading', 'AI', 'portfolio', 'NDL'],
  authors: [{ name: 'NDL AI Team' }],
  openGraph: {
    title: 'NDL - Solana DeFi Dashboard',
    description: 'Bảng điều khiển Portfolio, Signal và khuyến nghị giao dịch Solana DeFi.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // [QUAN TRỌNG] Thêm suppressHydrationWarning để chặn lỗi do ví Phantom chèn code
    <html lang="vi" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background antialiased`} suppressHydrationWarning>
        <ErrorBoundary>
          <WalletContextProvider>
            <AuthProvider>
              <TradingDemoProvider>
                <div className="relative flex min-h-screen flex-col">
                  {children}
                  
                  {showDebugPanel ? <DebugPanel /> : null}
                  
                  {/* Thông báo Toast */}
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
              </TradingDemoProvider>
            </AuthProvider>
          </WalletContextProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

async function DebugPanel() {
  const { WalletDebug } = await import('./components/wallet/WalletDebug');
  return <WalletDebug />;
}
