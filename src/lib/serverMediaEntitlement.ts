import type { SupabaseClient } from "@supabase/supabase-js";

export type MediaEntitlementResult =
  | {
      ready: true;
      enabled: boolean;
      globalEnabled: boolean;
      companyEnabled: boolean;
    }
  | {
      ready: false;
      reason: "READ_FAILED";
    };

type EnabledRow = {
  is_enabled: boolean;
};

export async function loadMediaEntitlement(
  supabase: SupabaseClient,
  tenantId: string,
  companyId: string,
): Promise<MediaEntitlementResult> {
  try {
    const [
      globalResult,
      companyResult,
    ] = await Promise.all([
      supabase
        .from("erp_platform_feature_switches")
        .select("is_enabled")
        .eq("feature_code", "MEDIA")
        .maybeSingle(),
      supabase
        .from("erp_company_feature_entitlements")
        .select("is_enabled")
        .eq("tenant_id", tenantId)
        .eq("company_id", companyId)
        .eq("feature_code", "MEDIA")
        .maybeSingle(),
    ]);

    if (globalResult.error || companyResult.error) {
      return {
        ready: false,
        reason: "READ_FAILED",
      };
    }

    const globalRow =
      globalResult.data as EnabledRow | null;
    const companyRow =
      companyResult.data as EnabledRow | null;

    const globalEnabled =
      globalRow?.is_enabled === true;
    const companyEnabled =
      companyRow?.is_enabled === true;

    return {
      ready: true,
      enabled: globalEnabled && companyEnabled,
      globalEnabled,
      companyEnabled,
    };
  } catch {
    return {
      ready: false,
      reason: "READ_FAILED",
    };
  }
}