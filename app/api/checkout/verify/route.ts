import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addUserPlace, kvAvailable, recordPurchase, setReport } from '@/lib/kv';
import { generateReport, generateReportForPlaceId } from '@/lib/report';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY' }, { status: 500 });
  }
  try {
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as any });
    const sess = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = sess.payment_status === 'paid';

    if (!paid) {
      return NextResponse.json({ paid: false }, { status: 402 });
    }

    const email = sess.customer_email || sess.metadata?.userEmail || '';
    const placeId = sess.metadata?.placeId || '';
    const originalUrl = sess.metadata?.originalUrl || '';

    // Generate fresh report and write to KV (best-effort — don't block payment confirmation if it fails)
    let storedReport: any = null;
    if (kvAvailable() && email) {
      try {
        const report = placeId
          ? await generateReportForPlaceId(placeId, originalUrl)
          : originalUrl
          ? await generateReport(originalUrl)
          : null;

        if (report) {
          await setReport(report.placeId, report);
          await addUserPlace(email, report.placeId);
          await recordPurchase({
            sessionId: sess.id,
            email,
            placeId: report.placeId,
            amount: sess.amount_total || 1000,
            createdAt: Date.now(),
          });
          storedReport = report;
        }
      } catch (e) {
        console.error('verify: report storage failed', e);
      }
    }

    return NextResponse.json({
      paid: true,
      rebuildId: sess.metadata?.rebuildId || null,
      email,
      placeId: storedReport?.placeId || placeId || null,
      kvWritten: !!storedReport,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Verify failed' }, { status: 500 });
  }
}
