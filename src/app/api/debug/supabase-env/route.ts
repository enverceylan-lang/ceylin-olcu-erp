import { NextRequest, NextResponse } from "next/server";

const getHost = (url?: string) => {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return "INVALID_URL";
  }
};

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const nextPublicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const supabaseUrlHost = getHost(supabaseUrl);
    const nextPublicSupabaseUrlHost = getHost(nextPublicSupabaseUrl);

    const expectedNewHost = "onmuadouvyjkmchcqgne.supabase.co";

    return NextResponse.json({
      success: true,
      nodeEnv: process.env.NODE_ENV || null,
      vercelEnv: process.env.VERCEL_ENV || null,
      supabaseUrlHost,
      nextPublicSupabaseUrlHost,
      hasServiceRoleKey: !!(serviceRoleKey && serviceRoleKey.trim() !== ""),
      hasAnonKey: !!(anonKey && anonKey.trim() !== ""),
      expectedNewHost,
      isSupabaseUrlNewHost: supabaseUrlHost === expectedNewHost,
      isNextPublicSupabaseUrlNewHost: nextPublicSupabaseUrlHost === expectedNewHost,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
