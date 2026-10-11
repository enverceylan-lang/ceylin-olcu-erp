import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export function GET() {
  const build = process.env.VERCEL_GIT_COMMIT_SHA || process.env.ENVERP_BUILD_SHA || null;
  return NextResponse.json({ build }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}
