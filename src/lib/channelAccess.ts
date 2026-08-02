export const ERP_CHANNELS = [
  "WEB",
  "MOBILE",
  "DESKTOP",
] as const;

export type ErpChannel =
  (typeof ERP_CHANNELS)[number];

export type ChannelAccessReason =
  | "ALLOWED"
  | "LICENSE_INACTIVE"
  | "USER_SCOPE_INACTIVE"
  | "LICENSE_CHANNEL_DENIED"
  | "USER_SCOPE_CHANNEL_DENIED";

export type ChannelAccessDecision = {
  allowed: boolean;
  channel: ErpChannel;
  reason: ChannelAccessReason;
};

export type ChannelAccessInput = {
  channel: ErpChannel;
  licenseActive: boolean;
  userScopeActive: boolean;
  licenseAllows: boolean;
  userScopeAllows: boolean;
};

export function isErpChannel(
  value: unknown,
): value is ErpChannel {
  return (
    typeof value === "string" &&
    ERP_CHANNELS.includes(
      value.trim().toUpperCase() as ErpChannel,
    )
  );
}

export function normalizeErpChannel(
  value: unknown,
): ErpChannel | null {
  const normalized =
    String(value ?? "")
      .trim()
      .toUpperCase();

  return isErpChannel(normalized)
    ? normalized
    : null;
}

export function decideChannelAccess(
  input: ChannelAccessInput,
): ChannelAccessDecision {
  if (!input.licenseActive) {
    return {
      allowed: false,
      channel: input.channel,
      reason: "LICENSE_INACTIVE",
    };
  }

  if (!input.userScopeActive) {
    return {
      allowed: false,
      channel: input.channel,
      reason: "USER_SCOPE_INACTIVE",
    };
  }

  if (!input.licenseAllows) {
    return {
      allowed: false,
      channel: input.channel,
      reason: "LICENSE_CHANNEL_DENIED",
    };
  }

  if (!input.userScopeAllows) {
    return {
      allowed: false,
      channel: input.channel,
      reason: "USER_SCOPE_CHANNEL_DENIED",
    };
  }

  return {
    allowed: true,
    channel: input.channel,
    reason: "ALLOWED",
  };
}

export function buildChannelAccessKey(
  scopeId: string,
  channel: ErpChannel,
): string {
  const cleanScopeId =
    String(scopeId || "").trim();

  if (!cleanScopeId) {
    throw new Error(
      "CHANNEL_ACCESS_SCOPE_REQUIRED",
    );
  }

  return `${cleanScopeId}:${channel}`;
}