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
  permissionVersion: number;
  sessionPermissionVersion: number;
};

type SessionPayload = {
  sub: string;
  username: string;
  role: string;
  authVersion: string;
  permissionVersion?: number;
  iat: number;
  exp: number;
};

// Legacy password hashing must stay available until all stored legacy hashes
// have been upgraded. New passwords must never be written with this function.
export function hashPassword(password: string): string {
  const cleanPassword = String(password || "").trim();
  const salt =
    process.env.HASH_SALT ||
    process.env.SESSION_SECRET ||
    "olcu-erp-salt-1293";

  return crypto
    .pbkdf2Sync(
      cleanPassword,
      salt,
      1000,
      64,
      "sha512",
    )
    .toString("hex");
}

const PASSWORD_V2_PREFIX = "enverp-pw-v2";
const PASSWORD_V2_KDF = "scrypt";
const PASSWORD_V2_SALT_BYTES = 16;
const PASSWORD_V2_KEY_BYTES = 64;

export type PasswordVerificationResult = {
  valid: boolean;
  needsRehash: boolean;
  version: "v2" | "legacy" | "unknown";
};

function safeEqualBuffer(
  left: Buffer,
  right: Buffer,
): boolean {
  return (
    left.length === right.length &&
    crypto.timingSafeEqual(left, right)
  );
}

export function hashPasswordV2(
  password: string,
): string {
  const cleanPassword =
    String(password || "").trim();

  if (!cleanPassword) {
    throw new Error(
      "PASSWORD_REQUIRED",
    );
  }

  const salt =
    crypto.randomBytes(
      PASSWORD_V2_SALT_BYTES,
    );

  const derived =
    crypto.scryptSync(
      cleanPassword,
      salt,
      PASSWORD_V2_KEY_BYTES,
    );

  return [
    PASSWORD_V2_PREFIX,
    PASSWORD_V2_KDF,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

export function verifyPassword(
  storedPasswordHash: string,
  suppliedPassword: string,
): PasswordVerificationResult {
  const stored =
    String(storedPasswordHash || "").trim();

  const supplied =
    String(suppliedPassword || "").trim();

  if (!stored || !supplied) {
    return {
      valid: false,
      needsRehash: false,
      version: "unknown",
    };
  }

  if (
    stored.startsWith(
      `${PASSWORD_V2_PREFIX}$`,
    )
  ) {
    const parts = stored.split("$");

    if (
      parts.length !== 4 ||
      parts[0] !== PASSWORD_V2_PREFIX ||
      parts[1] !== PASSWORD_V2_KDF ||
      !/^[0-9a-f]+$/i.test(parts[2]) ||
      !/^[0-9a-f]+$/i.test(parts[3])
    ) {
      return {
        valid: false,
        needsRehash: false,
        version: "v2",
      };
    }

    try {
      const salt =
        Buffer.from(parts[2], "hex");

      const expected =
        Buffer.from(parts[3], "hex");

      if (
        salt.length !==
          PASSWORD_V2_SALT_BYTES ||
        expected.length !==
          PASSWORD_V2_KEY_BYTES
      ) {
        return {
          valid: false,
          needsRehash: false,
          version: "v2",
        };
      }

      const actual =
        crypto.scryptSync(
          supplied,
          salt,
          expected.length,
        );

      return {
        valid:
          safeEqualBuffer(
            expected,
            actual,
          ),
        needsRehash: false,
        version: "v2",
      };
    }
    catch {
      return {
        valid: false,
        needsRehash: false,
        version: "v2",
      };
    }
  }

  const legacyHash =
    hashPassword(supplied);

  const legacyStored =
    Buffer.from(stored, "utf8");

  const legacySupplied =
    Buffer.from(
      legacyHash,
      "utf8",
    );

  const valid =
    safeEqualBuffer(
      legacyStored,
      legacySupplied,
    );

  return {
    valid,
    needsRehash: valid,
    version: "legacy",
  };
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

    const permissionVersion = 0;
    const sessionPermissionVersion =
      typeof payload.permissionVersion === "number"
        ? payload.permissionVersion
        : 0;

    if (permissionVersion !== sessionPermissionVersion) {
      return null;
    }

    return {
      ...user,
      permissionVersion,
      sessionPermissionVersion,
    };
  } catch {
    console.error("[Auth Verification] Request authentication failed.");
    return null;
  }
}
