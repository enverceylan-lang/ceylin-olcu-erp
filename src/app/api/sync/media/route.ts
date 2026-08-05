import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/authHelper";

// Media persistence is intentionally closed until storage + exact entity
// ownership validation is implemented server-side.
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);

  if (!user) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: "MEDIA_SYNC_NOT_IMPLEMENTED",
      reason:
        "Media upload is closed until server-side ERP scope and entity ownership validation are available.",
    },
    { status: 501 },
  );
}