import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  decideChannelAccess,
  type ChannelAccessDecision,
  type ErpChannel,
} from "@/lib/channelAccess";

type LicenseRow = {
  license_id: string;
  is_active: boolean;
};

type ChannelRow = {
  is_enabled: boolean;
};

export async function loadServerChannelAccess(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    userScopeId: string;
    channel: ErpChannel;
  },
): Promise<ChannelAccessDecision> {
  const tenantId =
    String(input.tenantId || "").trim();

  const userScopeId =
    String(input.userScopeId || "").trim();

  if (!tenantId || !userScopeId) {
    return decideChannelAccess({
      channel: input.channel,
      licenseActive: false,
      userScopeActive: false,
      licenseAllows: false,
      userScopeAllows: false,
    });
  }

  const {
    data: licenseData,
    error: licenseError,
  } = await supabase
    .from("erp_package_licenses")
    .select("license_id,is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  const license =
    licenseData as LicenseRow | null;

  if (
    licenseError ||
    !license ||
    !license.is_active
  ) {
    return decideChannelAccess({
      channel: input.channel,
      licenseActive: false,
      userScopeActive: true,
      licenseAllows: false,
      userScopeAllows: false,
    });
  }

  const [
    licenseChannelResult,
    scopeChannelResult,
  ] = await Promise.all([
    supabase
      .from("erp_license_channel_access")
      .select("is_enabled")
      .eq("license_id", license.license_id)
      .eq("channel_code", input.channel)
      .maybeSingle(),

    supabase
      .from("erp_user_scope_channel_access")
      .select("is_enabled")
      .eq("user_scope_id", userScopeId)
      .eq("channel_code", input.channel)
      .maybeSingle(),
  ]);

  const licenseChannel =
    licenseChannelResult.data as
      | ChannelRow
      | null;

  const scopeChannel =
    scopeChannelResult.data as
      | ChannelRow
      | null;

  return decideChannelAccess({
    channel: input.channel,
    licenseActive: true,
    userScopeActive: true,
    licenseAllows:
      !licenseChannelResult.error &&
      licenseChannel?.is_enabled === true,
    userScopeAllows:
      !scopeChannelResult.error &&
      scopeChannel?.is_enabled === true,
  });
}