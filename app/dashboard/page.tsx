import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser, getReport, kvAvailable } from '@/lib/kv';
import DashboardClient from '@/components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ searchParams }: { searchParams: { placeId?: string } }) {
  const session = await getServerSession(authOptions);

  // If KV isn't set up yet OR user isn't signed in, fall back to localStorage-driven client
  if (!kvAvailable() || !session?.user?.email) {
    return <DashboardClient initialReports={null} initialEmail={null} />;
  }

  const user = await getUser(session.user.email);
  if (!user || user.placeIds.length === 0) {
    return <DashboardClient initialReports={null} initialEmail={session.user.email} />;
  }

  const targetIds = searchParams.placeId
    ? user.placeIds.filter((id) => id === searchParams.placeId)
    : user.placeIds;
  const reports = (await Promise.all(targetIds.map((id) => getReport(id)))).filter(Boolean);

  return (
    <DashboardClient
      initialReports={reports as any[]}
      initialEmail={session.user.email}
      allPlaceIds={user.placeIds}
    />
  );
}
