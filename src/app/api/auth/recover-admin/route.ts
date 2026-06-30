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
  try {
    const recoveryTokenEnv = process.env.AUTH_RECOVERY_TOKEN;
    if (!recoveryTokenEnv || recoveryTokenEnv.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Recovery feature is disabled." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { recoveryToken, newPassword } = body;

    if (!recoveryToken || recoveryToken.trim() !== recoveryTokenEnv.trim()) {
      return NextResponse.json(
        { success: false, error: "Unauthorized recovery token." },
        { status: 401 }
      );
    }

    const cleanPassword = (newPassword || "").trim();
    if (!cleanPassword) {
      return NextResponse.json(
        { success: false, error: "Şifre boş olamaz." },
        { status: 400 }
      );
    }

    if (cleanPassword === "123") {
      return NextResponse.json(
        { success: false, error: "Güvenlik nedeniyle varsayılan şifre kullanılamaz." },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(cleanPassword);
    const now = new Date().toISOString();

    const { data: adminUser, error: fetchError } = await supabaseServer
      .from("users")
      .select("*")
      .eq("username", "admin")
      .single();

    if (fetchError || !adminUser) {
      return NextResponse.json(
        { success: false, error: "Admin kullanıcısı bulunamadı." },
        { status: 404 }
      );
    }

    if (!adminUser.isActive) {
      return NextResponse.json(
        { success: false, error: "Admin hesabı aktif değil." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseServer
      .from("users")
      .update({
        password: hashedPassword,
        updatedAt: now
      })
      .eq("username", "admin");

    if (updateError) {
      console.error("Admin recovery update failed:", updateError);
      return NextResponse.json(
        { success: false, error: "Veritabanı güncelleme hatası." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      username: "admin",
      passwordChanged: true,
      updatedAt: now
    });
  } catch (error: any) {
    console.error("Recovery API failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
