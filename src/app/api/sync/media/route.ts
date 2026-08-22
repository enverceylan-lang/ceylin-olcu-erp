import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireCompanySession } from "@/lib/companySessionGuard";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { loadMediaEntitlement } from "@/lib/serverMediaEntitlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

const MEDIA_BUCKET = "enverp-media";
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 2048;

type MediaTargetType =
  | "CUSTOMER"
  | "ROOM"
  | "OPENING"
  | "MEASUREMENT";

type MediaPurpose =
  | "ADDRESS_PHOTO"
  | "ROOM_PHOTO"
  | "OPENING_PHOTO"
  | "MEASUREMENT_PHOTO";

type AuthContext = {
  supabase: SupabaseClient;
  user: {
    id: string;
    role?: string | null;
  };
  userScopeId: string;
  tenantId: string;
  companyId: string;
  branchId: string;
  accountingPeriodId: string;
};

function getServerClient(): SupabaseClient | null {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function json(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

async function loadContext(
  req: NextRequest,
): Promise<
  | { ok: true; context: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const companySession =
    await requireCompanySession(req, "WEB");

  if (!companySession.allowed) {
    return {
      ok: false,
      response: json(
        {
          success: false,
          error: companySession.code,
        },
        companySession.status,
      ),
    };
  }

  const supabase = getServerClient();
  if (!supabase) {
    return {
      ok: false,
      response: json(
        {
          success: false,
          error: "MEDIA_SERVER_CONFIGURATION_MISSING",
        },
        503,
      ),
    };
  }

  const user = companySession.actor;
  const erpContext = await loadShadowErpContext(
    supabase,
    user.id,
    {
      requestedScopeId: readRequestedErpScopeId(req),
    },
  );

  if (!erpContext.ready) {
    return {
      ok: false,
      response: json(
        {
          success: false,
          error: erpContext.reason,
        },
        erpContext.reason === "READ_FAILED" ? 503 : 409,
      ),
    };
  }

  if (
    companySession.session.userScopeId !==
      String(companySession.session.userScopeId || "") ||
    companySession.session.tenantId !==
      erpContext.scope.tenantId ||
    companySession.session.companyId !==
      erpContext.scope.companyId
  ) {
    return {
      ok: false,
      response: json(
        {
          success: false,
          error: "MEDIA_SCOPE_SESSION_MISMATCH",
        },
        403,
      ),
    };
  }

  const mediaEntitlement =
    await loadMediaEntitlement(
      supabase,
      erpContext.scope.tenantId,
      erpContext.scope.companyId,
    );

  if (!mediaEntitlement.ready) {
    return {
      ok: false,
      response: json(
        {
          success: false,
          error: "MEDIA_ENTITLEMENT_READ_FAILED",
        },
        503,
      ),
    };
  }

  if (!mediaEntitlement.enabled) {
    return {
      ok: false,
      response: json(
        {
          success: false,
          error: "MEDIA_FEATURE_DISABLED",
        },
        403,
      ),
    };
  }

  return {
    ok: true,
    context: {
      supabase,
      user,
      userScopeId: companySession.session.userScopeId,
      tenantId: erpContext.scope.tenantId,
      companyId: erpContext.scope.companyId,
      branchId: erpContext.scope.branchId,
      accountingPeriodId:
        erpContext.scope.accountingPeriodId,
    },
  };
}

function isAdmin(context: AuthContext): boolean {
  return String(context.user.role || "").toUpperCase() === "ADMIN";
}

function normalizeTargetType(value: unknown): MediaTargetType | null {
  const clean = String(value || "").trim().toUpperCase();
  if (
    clean === "CUSTOMER" ||
    clean === "ROOM" ||
    clean === "OPENING" ||
    clean === "MEASUREMENT"
  ) {
    return clean;
  }
  return null;
}

function normalizePurpose(value: unknown): MediaPurpose | null {
  const clean = String(value || "").trim().toUpperCase();
  if (
    clean === "ADDRESS_PHOTO" ||
    clean === "ROOM_PHOTO" ||
    clean === "OPENING_PHOTO" ||
    clean === "MEASUREMENT_PHOTO"
  ) {
    return clean;
  }
  return null;
}

function purposeMatchesTarget(
  targetType: MediaTargetType,
  purpose: MediaPurpose,
): boolean {
  return (
    (targetType === "CUSTOMER" &&
      purpose === "ADDRESS_PHOTO") ||
    (targetType === "ROOM" &&
      purpose === "ROOM_PHOTO") ||
    (targetType === "OPENING" &&
      purpose === "OPENING_PHOTO") ||
    (targetType === "MEASUREMENT" &&
      purpose === "MEASUREMENT_PHOTO")
  );
}

async function assertTargetAuthority(
  context: AuthContext,
  targetType: MediaTargetType,
  targetId: string,
  operation: "UPLOAD" | "READ" | "MUTATE",
): Promise<boolean> {
  const scope = {
    tenant_id: context.tenantId,
    company_id: context.companyId,
    branch_id: context.branchId,
    accounting_period_id: context.accountingPeriodId,
  };

  if (targetType === "MEASUREMENT") {
    const { data, error } = await context.supabase
      .from("measurements")
      .select("id,measuredById")
      .eq("id", targetId)
      .eq("tenant_id", scope.tenant_id)
      .eq("company_id", scope.company_id)
      .eq("branch_id", scope.branch_id)
      .eq(
        "accounting_period_id",
        scope.accounting_period_id,
      )
      .maybeSingle();

    if (error || !data) return false;

    if (isAdmin(context)) return true;
    if (operation !== "UPLOAD") return false;

    return (
      String(data.measuredById || "") ===
      String(context.user.id)
    );
  }

  const table =
    targetType === "CUSTOMER"
      ? "customers"
      : targetType === "ROOM"
        ? "rooms"
        : "openings";

  const { data, error } = await context.supabase
    .from(table)
    .select("id")
    .eq("id", targetId)
    .eq("tenant_id", scope.tenant_id)
    .eq("company_id", scope.company_id)
    .eq("branch_id", scope.branch_id)
    .eq(
      "accounting_period_id",
      scope.accounting_period_id,
    )
    .maybeSingle();

  if (error || !data) return false;

  return isAdmin(context);
}

function rpcScope(context: AuthContext) {
  return {
    p_actor_user_id: context.user.id,
    p_actor_user_scope_id: context.userScopeId,
    p_tenant_id: context.tenantId,
    p_company_id: context.companyId,
    p_branch_id: context.branchId,
    p_accounting_period_id:
      context.accountingPeriodId,
  };
}

function parseWebpDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 30) return null;

  const text = (start: number, length: number) =>
    String.fromCharCode(
      ...bytes.slice(start, start + length),
    );

  if (
    text(0, 4) !== "RIFF" ||
    text(8, 4) !== "WEBP"
  ) {
    return null;
  }

  const chunk = text(12, 4);

  if (chunk === "VP8X" && bytes.length >= 30) {
    const width =
      1 +
      bytes[24] +
      (bytes[25] << 8) +
      (bytes[26] << 16);
    const height =
      1 +
      bytes[27] +
      (bytes[28] << 8) +
      (bytes[29] << 16);
    return { width, height };
  }

  if (chunk === "VP8L" && bytes.length >= 25) {
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    const width = 1 + (b0 | ((b1 & 0x3f) << 8));
    const height =
      1 +
      ((b1 >> 6) |
        (b2 << 2) |
        ((b3 & 0x0f) << 10));
    return { width, height };
  }

  if (chunk === "VP8 " && bytes.length >= 30) {
    for (
      let i = 20;
      i + 9 < Math.min(bytes.length, 64);
      i += 1
    ) {
      if (
        bytes[i] === 0x9d &&
        bytes[i + 1] === 0x01 &&
        bytes[i + 2] === 0x2a
      ) {
        const width =
          (bytes[i + 3] | (bytes[i + 4] << 8)) &
          0x3fff;
        const height =
          (bytes[i + 5] | (bytes[i + 6] << 8)) &
          0x3fff;
        return { width, height };
      }
    }
  }

  return null;
}

async function handlePrepare(
  req: NextRequest,
  context: AuthContext,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const targetType = normalizeTargetType(
    body.targetType,
  );
  const targetId = String(body.targetId || "").trim();
  const purpose = normalizePurpose(body.purpose);

  if (
    !targetType ||
    !purpose ||
    !targetId ||
    !purposeMatchesTarget(targetType, purpose)
  ) {
    return json(
      {
        success: false,
        error: "MEDIA_INVALID_TARGET_OR_PURPOSE",
      },
      400,
    );
  }

  if (
    !(await assertTargetAuthority(
      context,
      targetType,
      targetId,
      "UPLOAD",
    ))
  ) {
    return json(
      {
        success: false,
        error: "MEDIA_TARGET_FORBIDDEN",
      },
      403,
    );
  }

  const mimeType = String(body.mimeType || "");
  const byteSize = Number(body.byteSize || 0);
  const checksum = String(
    body.checksumSha256 || "",
  ).toLowerCase();
  const idempotencyKey = String(
    body.idempotencyKey || "",
  ).trim();
  const semanticHash = String(
    body.semanticHash || "",
  ).toLowerCase();
  const replaceLinkId = body.replaceLinkId
    ? String(body.replaceLinkId)
    : null;

  if (
    mimeType !== "image/webp" ||
    !Number.isSafeInteger(byteSize) ||
    byteSize < 1 ||
    byteSize > MAX_PHOTO_BYTES ||
    !/^[a-f0-9]{64}$/.test(checksum) ||
    !/^[a-f0-9]{64}$/.test(semanticHash)
  ) {
    return json(
      {
        success: false,
        error: "MEDIA_INVALID_COMPRESSED_PHOTO",
      },
      400,
    );
  }

  const { data, error } = await context.supabase.rpc(
    "prepare_media_upload_v1",
    {
      ...rpcScope(context),
      p_target_type: targetType,
      p_target_id: targetId,
      p_purpose: purpose,
      p_expected_mime_type: mimeType,
      p_expected_byte_size: byteSize,
      p_expected_checksum_sha256: checksum,
      p_idempotency_key: idempotencyKey,
      p_semantic_hash: semanticHash,
      p_replace_link_id: replaceLinkId,
    },
  );

  if (error || !data) {
    return json(
      {
        success: false,
        error:
          error?.message ||
          "MEDIA_PREPARE_FAILED",
      },
      409,
    );
  }

  const prepared = data as {
    replay?: boolean;
    intent_id: string;
    status: string;
    storage_bucket: string;
    storage_key: string;
    committed_link_id?: string | null;
  };

  if (
    prepared.status === "COMMITTED" &&
    prepared.committed_link_id
  ) {
    return json({
      success: true,
      replay: true,
      committed: true,
      intentId: prepared.intent_id,
      linkId: prepared.committed_link_id,
    });
  }

  if (
    prepared.storage_bucket !== MEDIA_BUCKET
  ) {
    return json(
      {
        success: false,
        error: "MEDIA_BUCKET_CONTRACT_MISMATCH",
      },
      500,
    );
  }

  const { data: signedData, error: signedError } =
    await context.supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(
        prepared.storage_key,
        {
          upsert: false,
        },
      );

  if (signedError || !signedData?.token) {
    return json(
      {
        success: false,
        error:
          signedError?.message ||
          "MEDIA_STORAGE_BUCKET_MISSING_OR_SIGN_FAILED",
      },
      503,
    );
  }

  return json({
    success: true,
    replay: Boolean(prepared.replay),
    committed: false,
    intentId: prepared.intent_id,
    bucket: MEDIA_BUCKET,
    path: prepared.storage_key,
    token: signedData.token,
  });
}

async function handleFinalize(
  context: AuthContext,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const intentId = String(body.intentId || "").trim();
  const sourceFilename = String(
    body.sourceFilename || "",
  ).slice(0, 240);

  if (!intentId) {
    return json(
      {
        success: false,
        error: "MEDIA_INTENT_REQUIRED",
      },
      400,
    );
  }

  const { data: inspectData, error: inspectError } =
    await context.supabase.rpc(
      "inspect_media_upload_intent_v1",
      {
        ...rpcScope(context),
        p_intent_id: intentId,
      },
    );

  if (inspectError || !inspectData) {
    return json(
      {
        success: false,
        error:
          inspectError?.message ||
          "MEDIA_INTENT_INSPECT_FAILED",
      },
      409,
    );
  }

  const intent = inspectData as {
    status: string;
    storage_bucket: string;
    storage_key: string;
    expected_mime_type: string;
    expected_byte_size: number;
    expected_checksum_sha256: string;
    committed_link_id?: string | null;
  };

  if (
    intent.status === "COMMITTED" &&
    intent.committed_link_id
  ) {
    return json({
      success: true,
      replay: true,
      linkId: intent.committed_link_id,
    });
  }

  if (intent.storage_bucket !== MEDIA_BUCKET) {
    return json(
      {
        success: false,
        error: "MEDIA_BUCKET_CONTRACT_MISMATCH",
      },
      500,
    );
  }

  const { data: blob, error: downloadError } =
    await context.supabase.storage
      .from(MEDIA_BUCKET)
      .download(intent.storage_key);

  if (downloadError || !blob) {
    return json(
      {
        success: false,
        error:
          downloadError?.message ||
          "MEDIA_UPLOADED_OBJECT_NOT_FOUND",
      },
      409,
    );
  }

  const buffer = Buffer.from(
    await blob.arrayBuffer(),
  );

  if (
    buffer.byteLength < 1 ||
    buffer.byteLength > MAX_PHOTO_BYTES
  ) {
    await context.supabase.storage
      .from(MEDIA_BUCKET)
      .remove([intent.storage_key]);

    await context.supabase.rpc(
      "mark_media_upload_failed_v1",
      {
        ...rpcScope(context),
        p_intent_id: intentId,
        p_failure_code:
          "OBJECT_BYTE_SIZE_OUT_OF_RANGE",
        p_retryable: false,
      },
    );

    return json(
      {
        success: false,
        error: "MEDIA_OBJECT_BYTE_SIZE_INVALID",
      },
      400,
    );
  }

  const checksum = createHash("sha256")
    .update(buffer)
    .digest("hex");

  const dimensions = parseWebpDimensions(
    new Uint8Array(buffer),
  );

  if (
    !dimensions ||
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > MAX_DIMENSION ||
    dimensions.height > MAX_DIMENSION ||
    intent.expected_mime_type !== "image/webp" ||
    Number(intent.expected_byte_size) !==
      buffer.byteLength ||
    String(
      intent.expected_checksum_sha256,
    ).toLowerCase() !== checksum
  ) {
    await context.supabase.storage
      .from(MEDIA_BUCKET)
      .remove([intent.storage_key]);

    await context.supabase.rpc(
      "mark_media_upload_failed_v1",
      {
        ...rpcScope(context),
        p_intent_id: intentId,
        p_failure_code:
          "OBJECT_VERIFICATION_MISMATCH",
        p_retryable: false,
      },
    );

    return json(
      {
        success: false,
        error: "MEDIA_OBJECT_VERIFICATION_MISMATCH",
      },
      409,
    );
  }

  const { data: finalizeData, error: finalizeError } =
    await context.supabase.rpc(
      "finalize_media_upload_v1",
      {
        ...rpcScope(context),
        p_intent_id: intentId,
        p_actual_mime_type: "image/webp",
        p_actual_byte_size: buffer.byteLength,
        p_actual_checksum_sha256: checksum,
        p_width_px: dimensions.width,
        p_height_px: dimensions.height,
        p_source_filename: sourceFilename || null,
      },
    );

  if (finalizeError || !finalizeData) {
    const { error: cleanupError } =
      await context.supabase.storage
        .from(MEDIA_BUCKET)
        .remove([intent.storage_key]);

    await context.supabase.rpc(
      "mark_media_upload_failed_v1",
      {
        ...rpcScope(context),
        p_intent_id: intentId,
        p_failure_code:
          cleanupError
            ? "FINALIZE_FAILED_ORPHAN_RETRY"
            : "FINALIZE_FAILED_OBJECT_REMOVED",
        p_retryable: Boolean(cleanupError),
      },
    );

    return json(
      {
        success: false,
        error:
          finalizeError?.message ||
          "MEDIA_FINALIZE_FAILED",
      },
      409,
    );
  }

  const finalized = finalizeData as {
    link_id: string;
    asset_id: string;
    delete_uploaded_duplicate?: boolean;
    duplicate_storage_bucket?: string | null;
    duplicate_storage_key?: string | null;
  };

  let duplicateCleanupWarning = false;
  if (
    finalized.delete_uploaded_duplicate &&
    finalized.duplicate_storage_bucket === MEDIA_BUCKET &&
    finalized.duplicate_storage_key
  ) {
    const { error: removeError } =
      await context.supabase.storage
        .from(MEDIA_BUCKET)
        .remove([finalized.duplicate_storage_key]);

    duplicateCleanupWarning =
      Boolean(removeError);
  }

  return json({
    success: true,
    replay: false,
    linkId: finalized.link_id,
    assetId: finalized.asset_id,
    duplicateCleanupWarning,
  });
}

async function listMedia(
  req: NextRequest,
  context: AuthContext,
): Promise<NextResponse> {
  if (!isAdmin(context)) {
    return json(
      {
        success: false,
        error: "MEDIA_READ_ADMIN_ONLY",
      },
      403,
    );
  }

  const targetType = normalizeTargetType(
    req.nextUrl.searchParams.get("targetType"),
  );
  const targetId = String(
    req.nextUrl.searchParams.get("targetId") || "",
  ).trim();

  if (!targetType || !targetId) {
    return json(
      {
        success: false,
        error: "MEDIA_INVALID_TARGET",
      },
      400,
    );
  }

  if (
    !(await assertTargetAuthority(
      context,
      targetType,
      targetId,
      "READ",
    ))
  ) {
    return json(
      {
        success: false,
        error: "MEDIA_TARGET_FORBIDDEN",
      },
      403,
    );
  }

  const { data, error } = await context.supabase.rpc(
    "list_entity_media_v1",
    {
      ...rpcScope(context),
      p_target_type: targetType,
      p_target_id: targetId,
    },
  );

  if (error) {
    return json(
      {
        success: false,
        error: error.message,
      },
      409,
    );
  }

  const rows = Array.isArray(data) ? data : [];
  const items = await Promise.all(
    rows.map(async (row) => {
      const item = row as {
        link_id: string;
        asset_id: string;
        purpose: string;
        mime_type: string;
        byte_size: number;
        width_px: number | null;
        height_px: number | null;
        storage_bucket: string;
        storage_key: string;
        created_at: string;
      };

      if (item.storage_bucket !== MEDIA_BUCKET) {
        throw new Error(
          "MEDIA_BUCKET_CONTRACT_MISMATCH",
        );
      }

      const { data: signed, error: signedError } =
        await context.supabase.storage
          .from(MEDIA_BUCKET)
          .createSignedUrl(item.storage_key, 300);

      if (signedError || !signed?.signedUrl) {
        throw new Error(
          signedError?.message ||
            "MEDIA_SIGNED_READ_FAILED",
        );
      }

      return {
        linkId: item.link_id,
        assetId: item.asset_id,
        purpose: item.purpose,
        mimeType: item.mime_type,
        byteSize: item.byte_size,
        widthPx: item.width_px,
        heightPx: item.height_px,
        createdAt: item.created_at,
        signedUrl: signed.signedUrl,
      };
    }),
  );

  return json({
    success: true,
    items,
  });
}

async function mutateLink(
  context: AuthContext,
  body: Record<string, unknown>,
  action: "archive" | "restore",
): Promise<NextResponse> {
  if (!isAdmin(context)) {
    return json(
      {
        success: false,
        error: "MEDIA_MUTATION_ADMIN_ONLY",
      },
      403,
    );
  }

  const linkId = String(body.linkId || "").trim();
  if (!linkId) {
    return json(
      {
        success: false,
        error: "MEDIA_LINK_REQUIRED",
      },
      400,
    );
  }

  const operationId = randomUUID();
  const idempotencyKey =
    `${action}:${linkId}:${operationId}`;
  const payloadHash = createHash("sha256")
    .update(
      JSON.stringify({
        action,
        linkId,
        tenantId: context.tenantId,
        companyId: context.companyId,
      }),
    )
    .digest("hex");

  const rpcName =
    action === "archive"
      ? "archive_entity_media_link_v1"
      : "restore_entity_media_link_v1";

  const params =
    action === "archive"
      ? {
          ...rpcScope(context),
          p_link_id: linkId,
          p_reason: String(
            body.reason || "USER_REMOVE",
          ).slice(0, 240),
          p_operation_id: operationId,
          p_idempotency_key: idempotencyKey,
          p_payload_hash: payloadHash,
        }
      : {
          ...rpcScope(context),
          p_link_id: linkId,
          p_operation_id: operationId,
          p_idempotency_key: idempotencyKey,
          p_payload_hash: payloadHash,
        };

  const { data, error } =
    await context.supabase.rpc(
      rpcName,
      params,
    );

  if (error) {
    return json(
      {
        success: false,
        error: error.message,
      },
      409,
    );
  }

  return json({
    success: true,
    result: data,
  });
}

export async function GET(
  req: NextRequest,
): Promise<NextResponse> {
  const auth = await loadContext(req);
  if (!auth.ok) return auth.response;

  try {
    return await listMedia(
      req,
      auth.context,
    );
  } catch (error) {
    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "MEDIA_READ_FAILED",
      },
      409,
    );
  }
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse> {
  const auth = await loadContext(req);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<
      string,
      unknown
    >;
  } catch {
    return json(
      {
        success: false,
        error: "MEDIA_INVALID_JSON",
      },
      400,
    );
  }

  const action = String(
    body.action || "",
  ).toLowerCase();

  try {
    if (action === "prepare") {
      return await handlePrepare(
        req,
        auth.context,
        body,
      );
    }

    if (action === "finalize") {
      return await handleFinalize(
        auth.context,
        body,
      );
    }

    if (action === "archive") {
      return await mutateLink(
        auth.context,
        body,
        "archive",
      );
    }

    if (action === "restore") {
      return await mutateLink(
        auth.context,
        body,
        "restore",
      );
    }

    return json(
      {
        success: false,
        error: "MEDIA_ACTION_UNSUPPORTED",
      },
      400,
    );
  } catch (error) {
    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "MEDIA_GATEWAY_FAILED",
      },
      409,
    );
  }
}
