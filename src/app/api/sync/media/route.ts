import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/authHelper";

// POST handler to upload attachment file binaries to storage
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { fileName, entityType, entityId } = body;

    // Media upload logic will go here in Phase 2
    return NextResponse.json({
      success: true,
      message: "Sync media upload POST skeleton.",
      media: {
        id: "media-skeleton-id",
        url: "https://via.placeholder.com/150",
        storagePath: `attachments/${fileName || "unknown.jpg"}`,
        entityType: entityType || "Room",
        entityId: entityId || "unknown-entity",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request payload" },
      { status: 400 }
    );
  }
}
