import { NextRequest } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export type AuthenticatedUser = {
  id: string;
  name?: string | null;
  username: string;
  role: string;
  isActive: boolean;
  permissions?: string[] | null;
  email?: string | null;
  phone?: string | null;
  tcNo?: string | null;
  address?: string | null;
  profileCompletedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type SessionPayload = {
  sub: string;
  username: string;
  role: string;
  authVersion: string;
  iat: number;
  exp: number;
};

// Legacy password hashing must stay available until the users table is migrated.
// Do not change its output or existing users will be unable to log in.
export function hashPassword(password: string): string {
  const cleanPassword = String(password || "").trim();
  const salt =
    process.env.HASH_SALT ||
    process.env.SESSION_SECRET ||
    "olcu-erp-salt-1293";

  return crypto
    .pbkdf2Sync(cleanPassword, salt, 1000, 64, "sha512")
    .toString("hex");
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(paddingLength), "base64");
}

function safeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function verifySessionToken(
  token: string,
  secret: string,
): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, suppliedSignature] = parts;
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(unsignedToken)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (!safeEqualText(suppliedSignature, expectedSignature)) {
    return null;
  }

  try {
    const header = JSON.parse(base64UrlDecode(encodedHeader).toString("utf8"));
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8"),
    ) as SessionPayload;

    if (header?.alg !== "HS256" || header?.typ !== "JWT") {
      return null;
    }

    if (
      !payload ||
      typeof payload.sub !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.authVersion !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    if (payload.exp <= nowSeconds || payload.iat > nowSeconds + 60) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function getAuthVersion(user: {
  updatedAt?: string | null;
  createdAt?: string | null;
}): string {
  return String(user.updatedAt || user.createdAt || "");
}

export async function verifyAuth(
  req: NextRequest,
): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.slice(7).trim();
    if (!token) return null;

    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sessionSecret = process.env.SESSION_SECRET;

    if (!supabaseUrl || !supabaseServiceKey || !sessionSecret) {
      console.error(
        "[Auth Config Error] Required server configuration is missing.",
      );
      return null;
    }

    const payload = verifySessionToken(token, sessionSecret);
    if (!payload) return null;

    const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabaseServer
      .from("users")
      .select(
        [
          "id",
          "name",
          "username",
          "role",
          "isActive",
          "permissions",
          "email",
          "phone",
          "tcNo",
          "address",
          "profileCompletedAt",
          "createdAt",
          "updatedAt",
        ].join(","),
      )
      .eq("id", payload.sub)
      .single();

    const user = data as AuthenticatedUser | null;

    if (error || !user || !user.isActive) {
      return null;
    }

    if (
      user.username !== payload.username ||
      user.role !== payload.role ||
      getAuthVersion(user) !== payload.authVersion
    ) {
      return null;
    }

    return user;
  } catch {
    console.error("[Auth Verification] Request authentication failed.");
    return null;
  }
}