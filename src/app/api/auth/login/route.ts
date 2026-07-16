import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { hashPassword } from "@/lib/authHelper";
import { normalizeUsername } from "@/lib/usernameHelper";

type SessionPayload = {
  sub: string;
  username: string;
  role: string;
  authVersion: string;
  iat: number;
  exp: number;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createSessionToken(payload: SessionPayload, secret: string): string {
  const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(unsignedToken)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${unsignedToken}.${signature}`;
}

function getAuthVersion(user: { updatedAt?: string | null; createdAt?: string | null }): string {
  return String(user.updatedAt || user.createdAt || "");
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!supabaseUrl || !supabaseServiceKey || !sessionSecret) {
    console.error("[Login Config Error] Required server configuration is missing.");
    return NextResponse.json(
      { success: false, error: "Sunucu yapılandırması tamamlanmamış." },
      { status: 500 },
    );
  }

  const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json();
    const cleanUsername = normalizeUsername(body?.username);
    const cleanPassword = String(body?.password || "").trim();
    const rememberMe = body?.rememberMe === true;

    if (!cleanUsername || !cleanPassword) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı adı ve şifre gereklidir." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseServer
      .from("users")
      .select([
        "id", "name", "username", "password", "role", "isActive", "permissions",
        "email", "phone", "tcNo", "address", "profileCompletedAt", "createdAt", "updatedAt",
      ].join(","))
      .eq("username", cleanUsername)
      .single();

    const user = data as any;

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı adı veya şifre hatalı." },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: "Bu hesap aktif değil." },
        { status: 401 },
      );
    }

    if (!user.password || String(user.password).trim() === "") {
      return NextResponse.json(
        { success: false, error: "Şifre tanımlanmamış." },
        { status: 401 },
      );
    }

    const defaultHashes = [
      "737cca8746ba4b84c7898f055c9f5c251016bd006f32ddf4be6fc2adde15fe72fa6167ed96001110725115f7308da9763712a5fa0924faf3329f301fc6e20382",
      hashPassword("123"),
    ];

    const isDefaultAdminCredentials =
      (user.username === "admin" || user.id === "user-admin") &&
      (cleanPassword === "123" || defaultHashes.includes(user.password));

    if (isDefaultAdminCredentials) {
      return NextResponse.json(
        {
          success: false,
          error: "Güvenlik nedeniyle varsayılan şifreyle giriş yapılamaz. Lütfen şifrenizi güncelleyin veya yöneticinizle iletişime geçin.",
        },
        { status: 401 },
      );
    }

    const hashedPassword = hashPassword(cleanPassword);
    const stored = Buffer.from(String(user.password), "utf8");
    const supplied = Buffer.from(hashedPassword, "utf8");
    const passwordMatches =
      stored.length === supplied.length && crypto.timingSafeEqual(stored, supplied);

    if (!passwordMatches) {
      return NextResponse.json(
        { success: false, error: "Kullanıcı adı veya şifre hatalı." },
        { status: 401 },
      );
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const sessionLifetimeSeconds = rememberMe ? 30 * 24 * 60 * 60 : 12 * 60 * 60;
    const sessionPayload: SessionPayload = {
      sub: String(user.id),
      username: String(user.username),
      role: String(user.role),
      authVersion: getAuthVersion(user),
      iat: nowSeconds,
      exp: nowSeconds + sessionLifetimeSeconds,
    };

    const sessionToken = createSessionToken(sessionPayload, sessionSecret);
    const { password: _password, ...sanitizedUser } = user;

    return NextResponse.json({
      success: true,
      user: {
        ...sanitizedUser,
        email: user.email || null,
        phone: user.phone || null,
        tcNo: user.tcNo || null,
        address: user.address || null,
        profileCompletedAt: user.profileCompletedAt || null,
      },
      session: {
        token: sessionToken,
        expiresAt: new Date(sessionPayload.exp * 1000).toISOString(),
        rememberMe,
      },
    });
  } catch {
    console.error("[Login API] Internal error.");
    return NextResponse.json(
      { success: false, error: "Giriş işlemi sırasında beklenmeyen bir hata oluştu." },
      { status: 500 },
    );
  }
}