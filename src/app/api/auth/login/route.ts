import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    // Login API Skeleton for Phase 1
    return NextResponse.json({
      success: true,
      message: "Login API route skeleton.",
      user: {
        id: "user-admin",
        name: "Yönetici (Admin) Skeleton",
        username: username || "admin",
        role: "ADMIN",
        isActive: true,
        permissions: [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
