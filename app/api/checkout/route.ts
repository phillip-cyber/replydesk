import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ requiresLogin: true });
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
    return NextResponse.json(
      { error: 'Payments are not configured.' },
      { status: 500 }
    );
  }
  try {
    const { rebuildId, originalUrl, placeId, placeName } = await req.json();
    if (!rebuildId) return NextResponse.json({ error: 'Missing rebuildId' }, { status: 400 });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as any });
    const origin = new URL(req.url).origin;
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: session.user.email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}&rebuildId=${encodeURIComponent(rebuildId)}`,
      cancel_url: `${origin}/?canceled=1`,
      metadata: {
        rebuildId,
        originalUrl: (originalUrl || '').slice(0, 480),
        placeId: (placeId || '').slice(0, 200),
        placeName: (placeName || '').slice(0, 200),
        userEmail: session.user.email,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: any) {
    console.error('checkout error', err);
    return NextResponse.json({ error: err.message || 'Checkout failed' }, { status: 500 });
  }
}
