import crypto from "crypto";
import {
  isErpChannel,
  type ErpChannel,
} from "@/lib/channelAccess";

export type CompanySessionPayload = {
  sub: string;
  username: string;
  role: string;
  authVersion: string;
  permissionVersion: number;

  sessionType: "COMPANY";
  channel: ErpChannel;

  tenantId: string;
  companyId: string;
  userScopeId: string;
  companySlug: string;

  iat: number;
  exp: number;
};

function base64UrlEncode(
  value: string,
): string {
  return Buffer.from(
    value,
    "utf8",
  )
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function createCompanySessionToken(
  payload: CompanySessionPayload,
  secret: string,
): string {
  const encodedHeader =
    base64UrlEncode(
      JSON.stringify({
        alg: "HS256",
        typ: "JWT",
      }),
    );

  const encodedPayload =
    base64UrlEncode(
      JSON.stringify(payload),
    );

  const unsignedToken =
    `${encodedHeader}.${encodedPayload}`;

  const signature =
    crypto
      .createHmac(
        "sha256",
        secret,
      )
      .update(unsignedToken)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  return `${unsignedToken}.${signature}`;
}
function base64UrlDecode(
  value: string,
): Buffer {
  const normalized =
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const paddingLength =
    (4 - (normalized.length % 4)) % 4;

  return Buffer.from(
    normalized +
      "=".repeat(paddingLength),
    "base64",
  );
}

function safeEqualText(
  left: string,
  right: string,
): boolean {
  const leftBuffer =
    Buffer.from(left, "utf8");

  const rightBuffer =
    Buffer.from(right, "utf8");

  return (
    leftBuffer.length ===
      rightBuffer.length &&
    crypto.timingSafeEqual(
      leftBuffer,
      rightBuffer,
    )
  );
}

export function readCompanySessionToken(
  token: string,
  secret: string,
): CompanySessionPayload | null {
  const parts =
    String(token || "").split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [
    encodedHeader,
    encodedPayload,
    suppliedSignature,
  ] = parts;

  const unsignedToken =
    `${encodedHeader}.${encodedPayload}`;

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        secret,
      )
      .update(unsignedToken)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  if (
    !safeEqualText(
      suppliedSignature,
      expectedSignature,
    )
  ) {
    return null;
  }

  try {
    const header =
      JSON.parse(
        base64UrlDecode(
          encodedHeader,
        ).toString("utf8"),
      ) as {
        alg?: unknown;
        typ?: unknown;
      };

    const payload =
      JSON.parse(
        base64UrlDecode(
          encodedPayload,
        ).toString("utf8"),
      ) as Partial<
        CompanySessionPayload
      >;

    if (
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      payload.sessionType !==
        "COMPANY" ||
      !isErpChannel(
        payload.channel,
      ) ||
      typeof payload.sub !==
        "string" ||
      typeof payload.username !==
        "string" ||
      typeof payload.role !==
        "string" ||
      typeof payload.authVersion !==
        "string" ||
      typeof payload.permissionVersion !==
        "number" ||
      typeof payload.tenantId !==
        "string" ||
      typeof payload.companyId !==
        "string" ||
      typeof payload.userScopeId !==
        "string" ||
      typeof payload.companySlug !==
        "string" ||
      typeof payload.iat !==
        "number" ||
      typeof payload.exp !==
        "number"
    ) {
      return null;
    }

    const nowSeconds =
      Math.floor(
        Date.now() / 1000,
      );

    if (
      payload.exp <= nowSeconds ||
      payload.iat >
        nowSeconds + 60
    ) {
      return null;
    }

    return payload as
      CompanySessionPayload;
  }
  catch {
    return null;
  }
}