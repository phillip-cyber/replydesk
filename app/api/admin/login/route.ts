// Deprecated: admin password gate was removed. This endpoint always 410s.
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function POST() {
  return NextResponse.json({ error: 'Gone — admin password removed.' }, { status: 410 });
}
