import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/authHelper";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://placeholder-project.supabase.co";

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "placeholder-service-key";

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
      return NextResponse.json(
        { success: false, error: "Yetkisiz erişim." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id } = body;

    if (!id || id === "user-admin") {
      return NextResponse.json(
        { success: false, error: "Geçersiz kullanıcı ID." },
        { status: 400 }
      );
    }

    const { count: measurementCount, error: measError } =
      await supabaseServer
        .from("measurements")
        .select("*", { count: "exact", head: true })
        .or(`createdById.eq.${id},measuredById.eq.${id}`);

    if (measError) {
      console.error("Error checking measurements link:", measError);
    }

    const { count: customerCount, error: custError } =
      await supabaseServer
        .from("customers")
        .select("*", { count: "exact", head: true })
        .or(
          `createdById.eq.${id},assignedSalesId.eq.${id},assignedMeasureId.eq.${id},assignedTailorId.eq.${id},assignedInstallerId.eq.${id}`
        );

    if (custError) {
      console.error("Error checking customers link:", custError);
    }

    const linkedMeasurements = measurementCount || 0;
    const linkedCustomers = customerCount || 0;
    const totalLinked = linkedMeasurements + linkedCustomers;

    if (totalLinked > 0) {
      return NextResponse.json(
        {
          success: false,
          code: "USER_HAS_LINKED_RECORDS",
          error:
            "Bu kullanıcıya bağlı kayıtlar bulunduğu için silinemez. Pasife alın.",
          linkedCounts: {
            measurements: linkedMeasurements,
            customers: linkedCustomers,
          },
        },
        { status: 409 }
      );
    }

    const { data: deletedUsers, error: deleteError } =
      await supabaseServer
        .from("users")
        .delete()
        .eq("id", id)
        .select("id");

    if (deleteError) {
      console.error("Real delete user failed:", deleteError);

      return NextResponse.json(
        { success: false, error: "Kullanıcı silinemedi." },
        { status: 500 }
      );
    }

    if (!deletedUsers || deletedUsers.length !== 1) {
      return NextResponse.json(
        {
          success: false,
          code: "USER_NOT_DELETED",
          error:
            "Kullanıcı veritabanından silinemedi veya kullanıcı bulunamadı.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      action: "DELETED",
      userId: deletedUsers[0].id,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}