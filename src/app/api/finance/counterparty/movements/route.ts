import {
  NextRequest,
  NextResponse
} from "next/server";

import {
  createClient
} from "@supabase/supabase-js";

import {
  verifyAuth
} from "@/lib/authHelper";

import {
  readRequestedErpScopeId
} from "@/lib/erpActiveScopeCookie";

import {
  loadShadowErpContext
} from "@/lib/serverErpContext";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, max-age=0"
} as const;

function json(
  body:
    Record<string, unknown>,
  status:
    number
) {
  return NextResponse.json(
    body,
    {
      status,
      headers:
        NO_STORE_HEADERS
    }
  );
}

interface CounterpartyMovementRow {
  movement_id:
    string;
  tenant_id:
    string;
  company_id:
    string;
  branch_id:
    string;
  accounting_period_id:
    string;
  idempotency_key:
    string;
  counterparty_customer_id:
    string;
  counterparty_type:
    "SUPPLIER"
    | "TAILOR"
    | "INSTALLER";
  movement_kind:
    "ACCRUAL"
    | "PAYMENT"
    | "REVERSAL";
  amount:
    number | string;
  currency:
    "TRY";
  occurred_at:
    string;
  recorded_at:
    string;
  source_document_id:
    string | null;
  operation_id:
    string | null;
  provider_earnings_entry_id:
    string | null;
  source_payment_id:
    string | null;
  reversal_of_movement_id:
    string | null;
  note:
    string | null;
}

function mapRow(
  row:
    CounterpartyMovementRow
) {
  return {
    tenantId:
      row.tenant_id,
    companyId:
      row.company_id,
    branchId:
      row.branch_id,
    accountingPeriodId:
      row.accounting_period_id,
    id:
      row.movement_id,
    idempotencyKey:
      row.idempotency_key,
    counterpartyCustomerId:
      row.counterparty_customer_id,
    counterpartyType:
      row.counterparty_type,
    kind:
      row.movement_kind,
    amount:
      Number(row.amount),
    currency:
      row.currency,
    occurredAt:
      row.occurred_at,
    recordedAt:
      row.recorded_at,
    ...(row.source_document_id
      ? {
          sourceDocumentId:
            row.source_document_id
        }
      : {}),
    ...(row.operation_id
      ? {
          operationId:
            row.operation_id
        }
      : {}),
    ...(row.provider_earnings_entry_id
      ? {
          providerEarningsEntryId:
            row.provider_earnings_entry_id
        }
      : {}),
    ...(row.source_payment_id
      ? {
          sourcePaymentId:
            row.source_payment_id
        }
      : {}),
    ...(row.reversal_of_movement_id
      ? {
          reversalOfMovementId:
            row.reversal_of_movement_id
        }
      : {}),
    ...(row.note
      ? {
          note:
            row.note
        }
      : {})
  };
}

export async function GET(
  request:
    NextRequest
) {
  const user =
    await verifyAuth(request);

  if (!user) {
    return json(
      {
        success:
          false,
        error:
          "UNAUTHORIZED"
      },
      401
    );
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    return json(
      {
        success:
          false,
        error:
          "SERVER_CONFIGURATION_MISSING"
      },
      500
    );
  }

  const supabaseServer =
    createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession:
            false,
          autoRefreshToken:
            false
        }
      }
    );

  const context =
    await loadShadowErpContext(
      supabaseServer,
      user.id,
      {
        requestedScopeId:
          readRequestedErpScopeId(
            request
          )
      }
    );

  if (!context.ready) {
    return json(
      {
        success:
          false,
        error:
          "ERP_CONTEXT_NOT_READY",
        reason:
          context.reason
      },
      context.reason ===
        "READ_FAILED"
        ? 503
        : 409
    );
  }

  const {
    tenantId,
    companyId,
    branchId,
    accountingPeriodId
  } = context.scope;

  const query =
    await supabaseServer
      .from(
        "counterparty_payable_movements"
      )
      .select(
        [
          "movement_id",
          "tenant_id",
          "company_id",
          "branch_id",
          "accounting_period_id",
          "idempotency_key",
          "counterparty_customer_id",
          "counterparty_type",
          "movement_kind",
          "amount",
          "currency",
          "occurred_at",
          "recorded_at",
          "source_document_id",
          "operation_id",
          "provider_earnings_entry_id",
          "source_payment_id",
          "reversal_of_movement_id",
          "note"
        ].join(",")
      )
      .eq(
        "tenant_id",
        tenantId
      )
      .eq(
        "company_id",
        companyId
      )
      .eq(
        "branch_id",
        branchId
      )
      .eq(
        "accounting_period_id",
        accountingPeriodId
      )
      .order(
        "occurred_at",
        {
          ascending:
            true
        }
      )
      .order(
        "movement_id",
        {
          ascending:
            true
        }
      );

  if (query.error) {
    console.error(
      "[Counterparty Payable Read API] Read failed."
    );

    return json(
      {
        success:
          false,
        error:
          "COUNTERPARTY_PAYABLE_READ_FAILED"
      },
      503
    );
  }

  const rows =
    (query.data || []) as unknown as
      CounterpartyMovementRow[];

  const movements =
    rows.map(
      mapRow
    );

  return json(
    {
      success:
        true,
      scope:
        context.scope,
      movements
    },
    200
  );
}