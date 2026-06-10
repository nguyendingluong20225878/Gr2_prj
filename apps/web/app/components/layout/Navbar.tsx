'use client';

import { useState } from 'react';
import type React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import {
  Activity,
  ChevronDown,
  LogOut,
  RotateCcw,
  Settings,
  User,
} from 'lucide-react';
import { navItems } from './navigationItems';

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
              <span className="block text-xs text-muted-foreground">Trợ lý quyết định crypto</span>
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((value) => !value)}
                className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-left transition-all hover:border-cyan-500/50"
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyber-purple to-cyber-cyan text-sm font-semibold text-white">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </span>
                <span className="hidden md:block">
                  <span className="block text-sm font-medium text-slate-100">{user.name || 'Người dùng'}</span>
                  <span className="block text-xs text-slate-400">{formatWalletAddress(user.walletAddress)}</span>
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {userMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl shadow-black/40 backdrop-blur"
                >
                  <div className="border-b border-white/10 px-3 py-2">
                    <p className="truncate text-sm font-semibold text-white">{user.name || 'Người dùng'}</p>
                    <p className="truncate font-mono text-xs text-slate-500">{user.walletAddress}</p>
                  </div>
                  <UserMenuLink href="/profile" icon={<User className="h-4 w-4" />} label="Hồ sơ" onClick={() => setUserMenuOpen(false)} />
                  <button
                    type="button"
                    disabled
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600"
                    title="Route cài đặt chưa có trong app"
                  >
                    <Settings className="h-4 w-4" />
                    Cài đặt
                  </button>
                  <UserMenuLink href="/onboarding" icon={<RotateCcw className="h-4 w-4" />} label="Làm lại onboarding" onClick={() => setUserMenuOpen(false)} />
                  <button
                    type="button"
                    onClick={() => {
                      setUserMenuOpen(false);
                      void logout();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Đăng xuất
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 px-3 py-2 text-sm font-bold text-cyan-300">
              <User className="h-4 w-4" />
              Đăng nhập
            </Link>
          )}
        </div>

        <div className="mt-4 hidden gap-2 overflow-x-auto pb-1 lg:flex xl:hidden" aria-label="Điều hướng chính trên tablet">
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

function UserMenuLink({
  href,
  icon,
  label,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      role="menuitem"
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-white/5 hover:text-cyan-300"
    >
      {icon}
      {label}
    </Link>
  );
}
