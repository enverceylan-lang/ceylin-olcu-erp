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

// GET: Check if users table is empty
export async function GET() {
  try {
    const { data: users, error } = await supabaseServer
      .from("users")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Bootstrap check database error:", error);
      // If error occurs (like table doesn't exist yet), return needsBootstrap: true
      return NextResponse.json({ success: true, needsBootstrap: true });
    }

    const needsBootstrap = !users || users.length === 0;
    return NextResponse.json({ success: true, needsBootstrap });
  } catch (error: any) {
    console.error("Bootstrap check error:", error);
    return NextResponse.json({ success: true, needsBootstrap: true });
  }
}

// POST: Seed the initial admin user with recovery token protection
export async function POST(req: NextRequest) {
  try {
    const recoveryTokenEnv = process.env.AUTH_RECOVERY_TOKEN;
    if (!recoveryTokenEnv || recoveryTokenEnv.trim() === "") {
      return NextResponse.json(
        { success: false, error: "Bootstrap feature is disabled." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { recoveryToken, password } = body;

    if (!recoveryToken || recoveryToken.trim() !== recoveryTokenEnv.trim()) {
      return NextResponse.json(
        { success: false, error: "Unauthorized recovery token." },
        { status: 401 }
      );
    }

    // 1. Check if users table is empty
    const { data: users, error: countError } = await supabaseServer
      .from("users")
      .select("id")
      .limit(1);

    if (countError) {
      return NextResponse.json(
        { success: false, error: "Database table not ready: " + countError.message },
        { status: 500 }
      );
    }

    if (users && users.length > 0) {
      return NextResponse.json(
        { success: false, error: "Bootstrap already completed." },
        { status: 409 }
      );
    }

    // 2. Validate password
    const cleanPassword = (password || "").trim();
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

    // 3. Create the default admin user
    const now = new Date().toISOString();
    const adminUser = {
      id: "user-admin",
      name: "Yönetici (Admin)",
      username: "admin",
      password: hashPassword(cleanPassword),
      role: "ADMIN",
      isActive: true,
      permissions: ["dashboard", "cariler", "olculer", "stok", "satis", "uretim", "montaj", "raporlar", "ayarlar"],
      createdAt: now,
      updatedAt: now
    };

    const { error: insertError } = await supabaseServer
      .from("users")
      .insert(adminUser);

    if (insertError) {
      console.error("Bootstrap insert error:", insertError);
      return NextResponse.json(
        { success: false, error: "Kullanıcı oluşturulamadı: " + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bootstrapped: true,
      username: "admin",
      role: "ADMIN",
      isActive: true,
      createdAt: now
    });
  } catch (error: any) {
    console.error("Bootstrap action error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
