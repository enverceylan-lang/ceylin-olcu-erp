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

    // 1. Check linked records in measurements table
    const { count: measurementCount, error: measError } = await supabaseServer
      .from("measurements")
      .select("*", { count: "exact", head: true })
      .or(`createdById.eq.${id},measuredById.eq.${id}`);

    if (measError) {
      console.error("Error checking measurements link:", measError);
    }

    // 2. Check linked records in customers table
    const { count: customerCount, error: custError } = await supabaseServer
      .from("customers")
      .select("*", { count: "exact", head: true })
      .or(`createdById.eq.${id},assignedSalesId.eq.${id},assignedMeasureId.eq.${id},assignedTailorId.eq.${id},assignedInstallerId.eq.${id}`);

    if (custError) {
      console.error("Error checking customers link:", custError);
    }

    const linkedMeasurements = measurementCount || 0;
    const linkedCustomers = customerCount || 0;
    const totalLinked = linkedMeasurements + linkedCustomers;

    if (totalLinked > 0) {
      return NextResponse.json({
        success: false,
        code: "USER_HAS_LINKED_RECORDS",
        linkedCounts: {
          measurements: linkedMeasurements,
          customers: linkedCustomers
        }
      }, { status: 409 });
    }

    // 3. Perform real delete
    const { error: deleteError } = await supabaseServer
      .from("users")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Real delete user failed:", deleteError);
      return NextResponse.json({ success: false, error: "Kullanıcı silinemedi." }, { status: 500 });
    }

    return NextResponse.json({ success: true, action: "DELETED", userId: id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Internal server error" }, { status: 500 });
  }
}
