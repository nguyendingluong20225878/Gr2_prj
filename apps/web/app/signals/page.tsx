import { redirect } from 'next/navigation';

export default function SignalsIndexPage() {
  redirect('/recommendations?tab=outside-portfolio');
}
