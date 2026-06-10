import { redirect } from 'next/navigation';

export default function OpportunitiesPage() {
  redirect('/recommendations?tab=outside-portfolio');
}
