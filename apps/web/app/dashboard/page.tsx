'use client';

import { useRouter } from 'next/navigation';
import { Dashboard } from '@/app/components/dashboard/Dashboard';
import { Layout } from '@/app/components/layout/Layout';

export default function DashboardPage() {
  const router = useRouter();

  return (
    <Layout>
      <Dashboard onViewProposal={(id) => router.push(`/proposal/${id}`)} />
    </Layout>
  );
}