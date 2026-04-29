import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Minimal placeholder so the modal's "email me a link" button doesn't 404.
// Wire this up to Resend (or any SMTP) when you're ready: needs RESEND_API_KEY,
// then sign a JWT with NEXTAUTH_SECRET, email it as a magic link to /api/auth/email-callback.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email.' }, { status: 400 });
    }
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Email sign-in is coming soon. Use Continue with Google for now.' },
        { status: 501 }
      );
    }
    // TODO: actually send the link. Until RESEND_API_KEY + adapter are wired,
    // we let the user know to use Google.
    return NextResponse.json(
      { error: 'Email sign-in is coming soon. Use Continue with Google for now.' },
      { status: 501 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Bad request.' }, { status: 400 });
  }
}
