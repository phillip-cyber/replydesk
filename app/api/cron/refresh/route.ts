import { NextRequest, NextResponse } from 'next/server';
import { listAllPlaceIds, setReport, kvAvailable } from '@/lib/kv';
import { generateReportForPlaceId } from '@/lib/report';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Vercel Cron calls this. Optional CRON_SECRET to gate manual hits.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  if (!kvAvailable()) {
    return NextResponse.json({ ok: false, reason: 'KV not configured' });
  }
  const ids = await listAllPlaceIds();
  const results: { placeId: string; status: 'ok' | 'error'; error?: string }[] = [];
  // Sequential to avoid hammering Anthropic + Places quota
  for (const id of ids) {
    try {
      const report = await generateReportForPlaceId(id);
      await setReport(id, report);
      results.push({ placeId: id, status: 'ok' });
    } catch (err: any) {
      results.push({ placeId: id, status: 'error', error: err.message });
    }
  }
  return NextResponse.json({ ok: true, refreshed: results.length, results });
}
