import { redirect } from 'next/navigation';

export default function OpportunityDetailPage({ params }: { params: { id: string } }) {
  redirect(`/proposal/${params.id}`);
}
