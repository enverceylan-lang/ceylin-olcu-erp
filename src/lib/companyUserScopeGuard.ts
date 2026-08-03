import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CompanySessionPayload } from "@/lib/companySession";

type ScopeRow = {
  user_scope_id: string;
  user_id: string;
  tenant_id: string;
  company_id: string;
  branch_id: string;
  accounting_period_id: string;
  is_default: boolean;
  is_active: boolean;
};

export async function listCompanyUserIds(
  supabase: SupabaseClient,
  session: CompanySessionPayload,
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from("erp_user_scopes")
    .select("user_id")
    .eq("tenant_id", session.tenantId)
    .eq("company_id", session.companyId)
    .eq("is_active", true);

  if (error) {
    return null;
  }

  return Array.from(
    new Set(
      (data || [])
        .map((row) => String(row.user_id || "").trim())
        .filter(Boolean),
    ),
  );
}

export async function isUserInCompany(
  supabase: SupabaseClient,
  session: CompanySessionPayload,
  userId: string,
): Promise<boolean> {
  const cleanUserId = String(userId || "").trim();
  if (!cleanUserId) return false;

  const { data, error } = await supabase
    .from("erp_user_scopes")
    .select("user_scope_id")
    .eq("user_id", cleanUserId)
    .eq("tenant_id", session.tenantId)
    .eq("company_id", session.companyId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  return !error && Boolean(data);
}

export async function findCompanyUsernameConflict(
  supabase: SupabaseClient,
  session: CompanySessionPayload,
  username: string,
  excludeUserId: string,
): Promise<{ id: string } | null | "READ_FAILED"> {
  const companyUserIds = await listCompanyUserIds(
    supabase,
    session,
  );

  if (companyUserIds === null) {
    return "READ_FAILED";
  }

  if (companyUserIds.length === 0) {
    return null;
  }

  let query = supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .in("id", companyUserIds)
    .limit(1);

  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return "READ_FAILED";
  }

  return data ? { id: String(data.id) } : null;
}

export async function createCompanyUserScope(
  supabase: SupabaseClient,
  session: CompanySessionPayload,
  userId: string,
): Promise<boolean> {
  const { data: actorScopeData, error: actorScopeError } =
    await supabase
      .from("erp_user_scopes")
      .select(
        "user_scope_id,user_id,tenant_id,company_id,branch_id,accounting_period_id,is_default,is_active",
      )
      .eq("user_scope_id", session.userScopeId)
      .eq("user_id", session.sub)
      .eq("tenant_id", session.tenantId)
      .eq("company_id", session.companyId)
      .eq("is_active", true)
      .maybeSingle();

  if (actorScopeError || !actorScopeData) {
    return false;
  }

  const actorScope = actorScopeData as ScopeRow;

  const { error: insertError } = await supabase
    .from("erp_user_scopes")
    .insert({
      user_scope_id: crypto.randomUUID(),
      user_id: userId,
      tenant_id: actorScope.tenant_id,
      company_id: actorScope.company_id,
      branch_id: actorScope.branch_id,
      accounting_period_id:
        actorScope.accounting_period_id,
      is_default: true,
      is_active: true,
    });

  return !insertError;
}