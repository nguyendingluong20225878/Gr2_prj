import {
  Activity,
  BarChart3,
  LineChart,
  Star,
  Wallet,
} from 'lucide-react';

export const navItems = [
  { path: '/overview', label: 'Tổng quan', shortLabel: 'Tổng quan', icon: Activity },
  { path: '/portfolio', label: 'Danh mục', shortLabel: 'Danh mục', icon: Wallet },
  { path: '/recommendations', label: 'Khuyến nghị', shortLabel: 'Khuyến nghị', icon: BarChart3 },
  { path: '/watchlist', label: 'Theo dõi', shortLabel: 'Theo dõi', icon: Star },
  { path: '/positions', label: 'Vị thế', shortLabel: 'Vị thế', icon: LineChart },
] as const;

export const bottomNavPaths = [
  '/overview',
  '/portfolio',
  '/recommendations',
  '/watchlist',
  '/positions',
] as const;
