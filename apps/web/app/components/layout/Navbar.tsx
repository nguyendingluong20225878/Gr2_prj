'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import {
  Activity,
  BarChart3,
  Bell,
  BrainCircuit,
  HeartPulse,
  LineChart,
  LogOut,
  Search,
  Star,
  User,
  Wallet,
} from 'lucide-react';

const navItems = [
  { path: '/overview', label: 'Tổng quan', icon: Activity },
  { path: '/portfolio', label: 'Danh mục', icon: Wallet },
  { path: '/diagnostics', label: 'Chẩn đoán', icon: HeartPulse },
  { path: '/recommendations', label: 'Khuyến nghị', icon: BarChart3 },
  { path: '/opportunities', label: 'Cơ hội', icon: Search },
  { path: '/watchlist', label: 'Theo dõi', icon: Star },
  { path: '/positions', label: 'Vị thế', icon: LineChart },
  { path: '/alerts', label: 'Cảnh báo', icon: Bell },
  { path: '/model-health', label: 'Mô hình', icon: BrainCircuit },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const formatWalletAddress = (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`;

  return (
    <nav className="sticky top-0 z-50 border-b border-border/50 glass-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/overview" className="flex items-center space-x-3 group">
            <span className="relative">
              <span className="absolute inset-0 rounded-lg bg-primary opacity-50 blur-lg transition-opacity group-hover:opacity-75" />
              <span className="relative flex rounded-lg bg-gradient-purple-cyan p-2">
                <Activity className="h-6 w-6 text-white" />
              </span>
            </span>
            <span>
              <span className="block text-xl font-bold gradient-text">NDL</span>
              <span className="block text-xs text-muted-foreground">Solana DeFi Dashboard</span>
            </span>
          </Link>

          <div className="hidden max-w-5xl flex-1 items-center justify-center gap-1 overflow-x-auto xl:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-all ${
                    isActive
                      ? 'border border-primary/50 bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/portfolio"
                className="hidden items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 transition-all hover:border-cyan-500/50 md:flex"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyber-purple to-cyber-cyan text-sm font-semibold text-white">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </span>
                <span className="text-left">
                  <span className="block text-sm font-medium text-slate-100">{user.name || 'Người dùng'}</span>
                  <span className="block text-xs text-slate-400">{formatWalletAddress(user.walletAddress)}</span>
                </span>
              </Link>
              <button
                onClick={logout}
                className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/15"
                aria-label="Đăng xuất"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 px-3 py-2 text-sm font-bold text-cyan-300">
              <User className="h-4 w-4" />
              Đăng nhập
            </Link>
          )}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 xl:hidden" aria-label="Điều hướng chính trên mobile">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                  isActive
                    ? 'border border-primary/50 bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
