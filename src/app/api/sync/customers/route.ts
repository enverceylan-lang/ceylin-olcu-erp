import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/authHelper";

// GET handler to fetch latest customer sync state
export async function GET(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    // Return unauthorized if user authentication fails in later phases
    // For now in phase 1, we just return a skeleton
  }

  return NextResponse.json({
    success: true,
    message: "Sync customers GET skeleton.",
    customers: [],
  });
}

// POST handler to upload customer sync state mutations
export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    // Return unauthorized if user authentication fails in later phases
    // For now in phase 1, we just return a skeleton
  }

  try {
    const body = await req.json();
    return NextResponse.json({
      success: true,
      message: "Sync customers POST skeleton.",
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Invalid request payload" },
      { status: 400 }
    );
  }
}
