'use client';

import { useRouter } from 'next/navigation';
import { ProposalDetailSocial } from '@/app/components/proposal/ProposalDetailSocial';
import { Layout } from '@/app/components/layout/Layout';

export default function ProposalDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  return (
    <Layout>
      <ProposalDetailSocial
        onBack={() => router.push('/dashboard')}
        onNavigateToPortfolio={() => router.push('/portfolio')}
      />
    </Layout>
  );
}