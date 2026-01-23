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
        // Lưu ý: Tôi đã bỏ onNavigateToPortfolio ở component con vì chưa dùng đến. 
        // Nếu bạn muốn dùng, hãy thêm nó vào interface ở bước 1.
      />
    </Layout>
  );
}