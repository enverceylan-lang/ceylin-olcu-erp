import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword } from "@/lib/authHelper";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Login Config Error] Missing SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json(
      {
        success: false,
        error: "Server configuration error",
        reason: "Missing SUPABASE_SERVICE_ROLE_KEY"
      },
      { status: 500 }
    );
  }

  // Diagnostic log for key validation (safe, no secret exposure)
  const keyType = process.env.SUPABASE_SERVICE_ROLE_KEY.startsWith("eyJhbGci") ? "service_role (valid JWT)" : "invalid format (not JWT)";
  console.log(`[Login Client Init] URL present: ${!!process.env.SUPABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_URL}, Service Role Key present: true, Key format: ${keyType}`);

  try {
    const body = await req.json();
    const { username, password } = body;

    const cleanUsername = (username || "").trim().toLowerCase();
    const cleanPassword = (password || "").trim();

    if (!cleanUsername || !cleanPassword) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı adı ve şifre gereklidir." },
        { status: 400 }
      );
    }

    const { data: user, error } = await supabaseServer
      .from("users")
      .select("*")
      .eq("username", cleanUsername)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı adı veya şifre hatalı." },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Bu hesap aktif değil." },
        { status: 401 }
      );
    }

    const hashedPassword = hashPassword(cleanPassword);
    if (user.password !== hashedPassword) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı adı veya şifre hatalı." },
        { status: 401 }
      );
    }

    // Sanitize user (exclude password hash) before returning to client
    const { password: _, ...sanitizedUser } = user;

    return NextResponse.json({
      success: true,
      user: sanitizedUser,
    });
  } catch (error: any) {
    console.error("Login API failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

