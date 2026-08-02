import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateErpScope,
  type ErpScope,
} from "./erpScope";
import {
  normalizeErpPackage,
  type ErpPackage,
} from "./packageFeatures";

export type ShadowErpContextFailureReason =
  | "USER_SCOPE_NOT_FOUND"
  | "USER_SCOPE_INVALID"
  | "LICENSE_NOT_FOUND"
  | "LICENSE_INVALID"
  | "READ_FAILED";

export type ShadowErpContextResult =
  | {
      ready: true;
      scope: ErpScope;
      package: ErpPackage;
      featureOverrides: Record<string, unknown>;
    }
  | {
      ready: false;
      reason: ShadowErpContextFailureReason;
    };

export interface UserScopeRow {
  user_scope_id?: string;
  tenant_id: string;
  company_id: string;
  branch_id: string;
  accounting_period_id: string;
  is_default: boolean;
  is_active: boolean;
}

export interface PackageLicenseRow {
  package_code: string;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  feature_overrides: unknown;
}


function normalizeOverrides(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...value } as Record<string, unknown>;
}

export function resolveShadowErpContext(input: {
  scopeRow: UserScopeRow | null;
  licenseRow: PackageLicenseRow | null;
  now: Date;
  requireDefault?: boolean;
}): ShadowErpContextResult {
  if (!input.scopeRow) {
    return { ready: false, reason: "USER_SCOPE_NOT_FOUND" };
  }

  if (
    !input.scopeRow.is_active ||
    (input.requireDefault !== false && !input.scopeRow.is_default)
  ) {
    return { ready: false, reason: "USER_SCOPE_INVALID" };
  }

  const scope: ErpScope = {
    tenantId: input.scopeRow.tenant_id,
    companyId: input.scopeRow.company_id,
    branchId: input.scopeRow.branch_id,
    accountingPeriodId: input.scopeRow.accounting_period_id,
  };

  if (!validateErpScope(scope).valid) {
    return { ready: false, reason: "USER_SCOPE_INVALID" };
  }

  if (!input.licenseRow) {
    return { ready: false, reason: "LICENSE_NOT_FOUND" };
  }

  const startsAt = new Date(input.licenseRow.starts_at);
  const endsAt = input.licenseRow.ends_at
    ? new Date(input.licenseRow.ends_at)
    : null;

  const normalizedPackage =
    normalizeErpPackage(input.licenseRow.package_code);

  if (
    !input.licenseRow.is_active ||
    !normalizedPackage ||
    Number.isNaN(startsAt.getTime()) ||
    startsAt > input.now ||
    (endsAt !== null &&
      (Number.isNaN(endsAt.getTime()) || endsAt < input.now))
  ) {
    return { ready: false, reason: "LICENSE_INVALID" };
  }

  return {
    ready: true,
    scope,
    package: normalizedPackage,
    featureOverrides: normalizeOverrides(
      input.licenseRow.feature_overrides
    ),
  };
}

export async function loadShadowErpContext(
  supabaseServer: SupabaseClient,
  userId: string,
  options: {
    now?: Date;
    requestedScopeId?: string | null;
  } = {}
): Promise<ShadowErpContextResult> {
  const now = options.now ?? new Date();
  const cleanUserId = String(userId || "").trim();
  if (!cleanUserId) {
    return { ready: false, reason: "USER_SCOPE_NOT_FOUND" };
  }

  try {
    let scopeQuery = supabaseServer
      .from("erp_user_scopes")
      .select(
        [
          "user_scope_id",
          "tenant_id",
          "company_id",
          "branch_id",
          "accounting_period_id",
          "is_default",
          "is_active",
        ].join(",")
      )
      .eq("user_id", cleanUserId)
      .eq("is_active", true);

    const requestedScopeId = String(
      options.requestedScopeId || ""
    ).trim();
    scopeQuery = requestedScopeId
      ? scopeQuery.eq("user_scope_id", requestedScopeId)
      : scopeQuery.eq("is_default", true);

    const { data: scopeData, error: scopeError } =
      await scopeQuery.maybeSingle();

    if (scopeError) {
      return { ready: false, reason: "READ_FAILED" };
    }

    const scopeRow = scopeData as UserScopeRow | null;
    if (!scopeRow) {
      return { ready: false, reason: "USER_SCOPE_NOT_FOUND" };
    }

    const nowIso = now.toISOString();
    const { data: licenseData, error: licenseError } = await supabaseServer
      .from("erp_package_licenses")
      .select(
        [
          "package_code",
          "starts_at",
          "ends_at",
          "is_active",
          "feature_overrides",
        ].join(",")
      )
      .eq("tenant_id", scopeRow.tenant_id)
      .eq("is_active", true)
      .lte("starts_at", nowIso)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .maybeSingle();

    if (licenseError) {
      return { ready: false, reason: "READ_FAILED" };
    }

    return resolveShadowErpContext({
      scopeRow,
      licenseRow: licenseData as PackageLicenseRow | null,
      now,
      requireDefault: !requestedScopeId,
    });
  } catch {
    return { ready: false, reason: "READ_FAILED" };
  }
}
