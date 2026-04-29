import AdminApp from '@/components/AdminApp';
import { getSeedLeads } from '@/lib/seed';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  const leads = getSeedLeads();
  return <AdminApp initialLeads={leads} />;
}
