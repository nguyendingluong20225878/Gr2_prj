'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { bottomNavPaths, navItems } from './navigationItems';

const bottomNavPathSet = new Set<string>(bottomNavPaths);
const bottomNavItems = navItems.filter((item) => bottomNavPathSet.has(item.path));

export function MobileBottomNav() {
  const pathname = usePathname();
  const shouldShow = bottomNavPathSet.has(pathname);

  if (!shouldShow) return null;

  return (
    <nav
      aria-label="Điều hướng chính trên mobile"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/90 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2 shadow-[0_-18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex max-w-xl gap-1 overflow-x-auto overscroll-x-contain pb-1">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;

          return (
            <Link
              key={item.path}
              href={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-w-[4.75rem] flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 ${
                isActive
                  ? 'border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 shadow-[0_0_18px_rgba(6,182,212,0.15)]'
                  : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-cyan-300' : 'text-slate-500'}`} />
              <span className="max-w-full truncate">{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
