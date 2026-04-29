import { NextRequest, NextResponse } from 'next/server';
import { generateReport } from '@/lib/report';

export const runtime = 'nodejs';
export const maxDuration = 60;

function normalizeUrl(raw: string): string | null {
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!u.hostname.includes('.')) return null;
    return u.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    const target = normalizeUrl(url);
    if (!target) return NextResponse.json({ error: 'Provide a valid restaurant website URL.' }, { status: 400 });

    const report = await generateReport(target);
    return NextResponse.json(report);
  } catch (err: any) {
    console.error('preview error', err);
    const status = /not configured/i.test(err.message) ? 500 : /couldn.?t match|no reviews/i.test(err.message) ? 404 : 500;
    return NextResponse.json({ error: err.message || 'Internal error' }, { status });
  }
}
