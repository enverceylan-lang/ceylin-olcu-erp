import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { hashPassword } from "@/lib/authHelper";
import { normalizeUsername } from "@/lib/usernameHelper";
import {
  LEGACY_FINANCE_PERMISSION_VERSION,
  resolveFinancePermissions,
} from "@/lib/finance/financePermissionResolver";

type SessionPayload = {
  sub: string;
  username: string;
  role: string;
  authVersion: string;
  permissionVersion: number;
  iat: number;
  exp: number;
};

type LoginUserRecord = {
  id: string;
  name: string | null;
  username: string;
  password: string;
  role: string;
  isActive: boolean;
  permissions: unknown[] | null;
  email: string | null;
  phone: string | null;
  providerCustomerId: string | null;
  providerType: "TAILOR" | "INSTALLER" | null;
  tcNo: string | null;
  address: string | null;
  profileCompletedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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

function genericUnauthorized() {
  return NextResponse.json(
    { success: false, error: "Kullanıcı adı veya şifre hatalı." },
    { status: 401 },
  );
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
        "providerCustomerId", "providerType",
      ].join(","))
      .eq("username", cleanUsername)
      .single();

    const user = data as LoginUserRecord | null;

    if (error || !user) {
      return genericUnauthorized();
    }

    if (
      !user.isActive ||
      !user.password ||
      String(user.password).trim() === "" ||
      user.role !== "PLATFORM_SUPER_ADMIN"
    ) {
      return genericUnauthorized();
    }

    const localDevUsername = normalizeUsername(
      process.env.LOCAL_DEV_ADMIN_USERNAME || "",
    );

    const localDevPasswordHash = String(
      process.env.LOCAL_DEV_ADMIN_PASSWORD_HASH || "",
    ).trim();

    let localPasswordMatches = false;

    if (
      process.env.NODE_ENV === "development" &&
      localDevUsername &&
      localDevPasswordHash &&
      cleanUsername === localDevUsername
    ) {
      const suppliedLocalHash = crypto
        .createHash("sha256")
        .update(cleanPassword, "utf8")
        .digest("hex");

      const storedLocal = Buffer.from(localDevPasswordHash, "utf8");
      const suppliedLocal = Buffer.from(suppliedLocalHash, "utf8");

      localPasswordMatches =
        storedLocal.length === suppliedLocal.length &&
        crypto.timingSafeEqual(storedLocal, suppliedLocal);
    }

    const hashedPassword = hashPassword(cleanPassword);
    const stored = Buffer.from(String(user.password), "utf8");
    const supplied = Buffer.from(hashedPassword, "utf8");
    const passwordMatches =
      stored.length === supplied.length &&
      crypto.timingSafeEqual(stored, supplied);

    if (!passwordMatches && !localPasswordMatches) {
      return genericUnauthorized();
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const permissionResolution = resolveFinancePermissions({
      role: user.role,
      storedPermissions: user.permissions,
      financePermissionGrants: [],
      financePermissionDenies: [],
      permissionVersion: LEGACY_FINANCE_PERMISSION_VERSION,
      expectedPermissionVersion: LEGACY_FINANCE_PERMISSION_VERSION,
      applyRoleDefaults: true,
    });

    const sessionLifetimeSeconds = 12 * 60 * 60;

    const sessionPayload: SessionPayload = {
      sub: String(user.id),
      username: String(user.username),
      role: String(user.role),
      authVersion: getAuthVersion(user),
      permissionVersion: LEGACY_FINANCE_PERMISSION_VERSION,
      iat: nowSeconds,
      exp: nowSeconds + sessionLifetimeSeconds,
    };

    const sessionToken = createSessionToken(
      sessionPayload,
      sessionSecret,
    );

    const sanitizedUser = Object.fromEntries(
      Object.entries(user).filter(
        ([key]) => key !== "password",
      ),
    ) as Omit<LoginUserRecord, "password">;

    return NextResponse.json({
      success: true,
      user: {
        ...sanitizedUser,
        storedPermissions: Array.isArray(user.permissions)
          ? [...user.permissions]
          : [],
        permissions: permissionResolution.effectivePermissions,
        permissionVersion: LEGACY_FINANCE_PERMISSION_VERSION,
        email: user.email || null,
        phone: user.phone || null,
        providerCustomerId:
          user.providerCustomerId || null,
        providerType:
          user.providerType || null,
        tcNo: user.tcNo || null,
        address: user.address || null,
        profileCompletedAt: user.profileCompletedAt || null,
      },
      session: {
        token: sessionToken,
        expiresAt: new Date(sessionPayload.exp * 1000).toISOString(),
        rememberMe: false,
        permissionVersion: LEGACY_FINANCE_PERMISSION_VERSION,
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