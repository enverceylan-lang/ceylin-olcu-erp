import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { hashPassword } from "@/lib/authHelper";

const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});

// GET: Check if users table is empty and system needs bootstrapping
export async function GET() {
  try {
    const { data: users, error } = await supabaseServer
      .from("users")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Bootstrap check database error:", error);
      // If table doesn't exist yet, we also treat it as needing bootstrap/migration
      return NextResponse.json({ success: true, needsBootstrap: true });
    }

    const needsBootstrap = !users || users.length === 0;
    return NextResponse.json({ success: true, needsBootstrap });
  } catch (error: any) {
    console.error("Bootstrap check error:", error);
    return NextResponse.json({ success: true, needsBootstrap: true });
  }
}

// POST: Seed the initial admin user on first install
export async function POST() {
  try {
    // 1. Check if users table is empty
    const { data: users, error: countError } = await supabaseServer
      .from("users")
      .select("id")
      .limit(1);

    if (countError) {
      // If table doesn't exist, we cannot bootstrap yet (db schema needs migration first)
      return NextResponse.json({ success: false, error: "Database table not ready: " + countError.message }, { status: 500 });
    }

    if (users && users.length > 0) {
      return NextResponse.json(
        { success: false, error: "System already bootstrapped. Access denied." },
        { status: 403 }
      );
    }

    // 2. Create the default admin user
    const now = new Date().toISOString();
    const adminUser = {
      id: "user-admin",
      name: "Yönetici (Admin)",
      username: "admin",
      password: hashPassword("123"),
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
      return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Admin user bootstrapped successfully."
    });
  } catch (error: any) {
    console.error("Bootstrap action error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
