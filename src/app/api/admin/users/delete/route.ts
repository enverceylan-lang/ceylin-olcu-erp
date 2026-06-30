import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export async function POST(req: NextRequest) {
  try {
    const caller = await verifyAuth(req);
    if (!caller || caller.role?.toLowerCase() !== "admin") {
      return NextResponse.json({ success: false, error: "Yetkisiz erişim." }, { status: 401 });
    }

    const body = await req.json();
    const { id } = body;

    if (!id || id === "user-admin") {
      return NextResponse.json({ success: false, error: "Geçersiz kullanıcı ID." }, { status: 400 });
    }

    // Soft delete: update isActive to false
    const { error } = await supabaseServer
      .from("users")
      .update({ isActive: false, updatedAt: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("Soft delete user failed:", error);
      return NextResponse.json({ success: false, error: "Kullanıcı devre dışı bırakılamadı." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
