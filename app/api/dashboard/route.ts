import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser, getReport, kvAvailable } from '@/lib/kv';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ authed: false }, { status: 401 });
  }
  if (!kvAvailable()) {
    return NextResponse.json({ authed: true, kvAvailable: false, restaurants: [], reports: [] });
  }

  const url = new URL(req.url);
  const onlyPlaceId = url.searchParams.get('placeId');

  const user = await getUser(session.user.email);
  if (!user || user.placeIds.length === 0) {
    return NextResponse.json({ authed: true, kvAvailable: true, restaurants: [], reports: [] });
  }

  const ids = onlyPlaceId ? user.placeIds.filter((p) => p === onlyPlaceId) : user.placeIds;
  const reports = (await Promise.all(ids.map((id) => getReport(id)))).filter(Boolean);

  return NextResponse.json({
    authed: true,
    kvAvailable: true,
    email: session.user.email,
    restaurants: user.placeIds,
    reports,
  });
}
