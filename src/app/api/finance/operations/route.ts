import { stableFinanceOperationHash } from "@/lib/finance/stableFinanceOperationHash";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { verifyAuth } from "@/lib/authHelper";
import { readRequestedErpScopeId } from "@/lib/erpActiveScopeCookie";
import { loadShadowErpContext } from "@/lib/serverErpContext";
import { guardServerFinanceChannelAccess } from "@/lib/serverFinanceAccessGuard";
import { decideFinanceServerOperationContract } from "@/lib/finance/financeOperationsServerContract";
import {
  persistFinanceOperationV1,
  type FinanceOperationsRpcClient
} from "@/lib/finance/financeOperationsSupabaseGateway";
import {
  persistFinanceCounterpartyPaymentV1,
  persistFinanceCounterpartyPaymentReversalV1,
  type FinanceCounterpartyPaymentRpcClient,
  type FinanceCounterpartyPaymentReversalRpcClient
} from "@/lib/finance/financeCounterpartyPaymentSupabaseGateway";
import { decidePosServerAuthorityContract } from "@/lib/finance/posServerAuthorityPolicy";
import {
  persistFinancePosAuthorityV1,
  type PosServerAuthorityRpcClient
} from "@/lib/finance/posServerAuthoritySupabaseGateway";
import {
  decideCollectionServerContract,
  decideCollectionReversalServerContract,
  decideInstrumentTransitionServerContract
} from "@/lib/finance/collectionServerContract";
import {
  persistFinanceCollectionV1,
  persistCollectionMutationV1,
  type CollectionRpcClient,
  type CollectionMutationRpcClient
} from "@/lib/finance/collectionSupabaseGateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {decidePayableInstrumentCreateServerContract,decidePayableInstrumentTransitionServerContract} from "@/lib/finance/payableInstrumentServerContract";
import {persistFinancePayableInstrumentV1,transitionFinancePayableInstrumentV1,type PayableInstrumentRpcClient} from "@/lib/finance/payableInstrumentSupabaseGateway";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0"
} as const;

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function hasPosCommand(body: unknown): boolean {
  return Boolean(
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Object.prototype.hasOwnProperty.call(body, "posCommand")
  );
}

function hasCollectionCommand(body: unknown): boolean {
  return Boolean(
    body && typeof body === "object" && !Array.isArray(body) &&
    Object.prototype.hasOwnProperty.call(body, "collectionCommand")
  );
}

function hasCommand(body: unknown, key: string): boolean {
  return Boolean(
    body && typeof body === "object" && !Array.isArray(body) &&
    Object.prototype.hasOwnProperty.call(body, key)
  );
}

type PaymentCounterpartyType =
  | "SUPPLIER"
  | "TAILOR"
  | "INSTALLER";

function readPaymentCounterpartyType(
  body: unknown,
): PaymentCounterpartyType | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const value = (body as { counterpartyType?: unknown }).counterpartyType;

  return value === "SUPPLIER" ||
    value === "TAILOR" ||
    value === "INSTALLER"
    ? value
    : null;
}

export async function POST(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) {
    return json({ success: false, error: "UNAUTHORIZED" }, 401);
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ success: false, error: "SERVER_CONFIGURATION_MISSING" }, 500);
  }

  const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const context = await loadShadowErpContext(supabaseServer, user.id, {
    requestedScopeId: readRequestedErpScopeId(request)
  });

  if (!context.ready) {
    return json(
      {
        success: false,
        error: "ERP_CONTEXT_NOT_READY",
        reason: context.reason
      },
      context.reason === "READ_FAILED" ? 503 : 409
    );
  }

  const body = await request.json().catch(() => null);

  if (hasCommand(body, "collectionReversalCommand")) {
    const decision = decideCollectionReversalServerContract(body, context.scope);
    if (!decision.allowed) return json({ success: false, error: decision.code }, decision.status);
    const access = guardServerFinanceChannelAccess({
      authenticatedUser: {
        id: user.id, role: user.role, storedPermissions: user.permissions,
        permissionVersion: user.permissionVersion,
        sessionPermissionVersion: user.sessionPermissionVersion
      },
      channel: decision.command.channel,
      operation: decision.operation,
      direction: "REVERSE",
      requestedPermission: decision.requestedPermission as never,
      packageType: context.package,
      actorScope: context.scope,
      resourceScope: context.scope
    });
    if (!access.allowed) return json({ success: false, error: "FINANCE_ACCESS_DENIED", reason: access.reasonCode }, 403);
    const serverCommand = { ...decision.command, ...context.scope };
    try {
      const result = await persistCollectionMutationV1(
        supabaseServer as unknown as CollectionMutationRpcClient,
        "reverse_finance_collection_v1",
        serverCommand as unknown as Record<string, unknown>,
        user.id,
        stableFinanceOperationHash(serverCommand)
      );
      const status = result.outcome === "CREATED" ? 201 : result.outcome === "REPLAY" ? 200 :
        result.outcome === "CONFLICT" ? 409 : 422;
      return json({ success: result.outcome === "CREATED" || result.outcome === "REPLAY", ...result }, status);
    } catch {
      console.error("[Finance Collection Reversal API] Persistence failed.");
      return json({ success: false, error: "FINANCE_COLLECTION_REVERSAL_PERSISTENCE_FAILED" }, 503);
    }
  }

  if (hasCommand(body, "instrumentTransitionCommand")) {
    const decision = decideInstrumentTransitionServerContract(body, context.scope);
    if (!decision.allowed) return json({ success: false, error: decision.code }, decision.status);
    const access = guardServerFinanceChannelAccess({
      authenticatedUser: {
        id: user.id, role: user.role, storedPermissions: user.permissions,
        permissionVersion: user.permissionVersion,
        sessionPermissionVersion: user.sessionPermissionVersion
      },
      channel: decision.command.instrumentType,
      operation: decision.operation,
      direction: decision.direction,
      requestedPermission: decision.requestedPermission as never,
      packageType: context.package,
      actorScope: context.scope,
      resourceScope: context.scope
    });
    if (!access.allowed) return json({ success: false, error: "FINANCE_ACCESS_DENIED", reason: access.reasonCode }, 403);
    const serverCommand = { ...decision.command, ...context.scope };
    try {
      const result = await persistCollectionMutationV1(
        supabaseServer as unknown as CollectionMutationRpcClient,
        "transition_finance_receivable_instrument_v1",
        serverCommand as unknown as Record<string, unknown>,
        user.id,
        stableFinanceOperationHash(serverCommand)
      );
      const status = result.outcome === "CREATED" ? 201 : result.outcome === "REPLAY" ? 200 :
        result.outcome === "CONFLICT" ? 409 : 422;
      return json({ success: result.outcome === "CREATED" || result.outcome === "REPLAY", ...result }, status);
    } catch {
      console.error("[Finance Instrument Transition API] Persistence failed.");
      return json({ success: false, error: "FINANCE_INSTRUMENT_TRANSITION_PERSISTENCE_FAILED" }, 503);
    }
  }

  if (hasCommand(body, "payableInstrumentCommand")) {
    const decision=decidePayableInstrumentCreateServerContract(body,context.scope);
    if(!decision.allowed)return json({success:false,error:decision.code},decision.status);
    const access=guardServerFinanceChannelAccess({authenticatedUser:{id:user.id,role:user.role,storedPermissions:user.permissions,permissionVersion:user.permissionVersion,sessionPermissionVersion:user.sessionPermissionVersion},channel:decision.command.instrumentType,operation:"ISSUE",direction:"CREATE",requestedPermission:decision.requestedPermission as never,packageType:context.package,actorScope:context.scope,resourceScope:context.scope});
    if(!access.allowed)return json({success:false,error:"FINANCE_ACCESS_DENIED",reason:access.reasonCode},403);
    const command={...decision.command,...context.scope};
    try{const result=await persistFinancePayableInstrumentV1(supabaseServer as unknown as PayableInstrumentRpcClient,command as unknown as Record<string,unknown>,user.id,stableFinanceOperationHash(command));const status=result.outcome==="CREATED"?201:result.outcome==="REPLAY"?200:result.outcome==="CONFLICT"?409:422;return json({success:result.outcome==="CREATED"||result.outcome==="REPLAY",...result},status)}catch{return json({success:false,error:"FINANCE_PAYABLE_INSTRUMENT_PERSISTENCE_FAILED"},503)}
  }

  if (hasCommand(body, "payableInstrumentTransitionCommand")) {
    const decision=decidePayableInstrumentTransitionServerContract(body,context.scope);
    if(!decision.allowed)return json({success:false,error:decision.code},decision.status);
    const access=guardServerFinanceChannelAccess({authenticatedUser:{id:user.id,role:user.role,storedPermissions:user.permissions,permissionVersion:user.permissionVersion,sessionPermissionVersion:user.sessionPermissionVersion},channel:decision.command.instrumentType,operation:"ISSUE",direction:decision.direction,requestedPermission:decision.requestedPermission as never,packageType:context.package,actorScope:context.scope,resourceScope:context.scope});
    if(!access.allowed)return json({success:false,error:"FINANCE_ACCESS_DENIED",reason:access.reasonCode},403);
    const command={...decision.command,...context.scope};
    try{const result=await transitionFinancePayableInstrumentV1(supabaseServer as unknown as PayableInstrumentRpcClient,command as unknown as Record<string,unknown>,user.id,stableFinanceOperationHash(command));const status=result.outcome==="CREATED"?201:result.outcome==="REPLAY"?200:result.outcome==="CONFLICT"?409:422;return json({success:result.outcome==="CREATED"||result.outcome==="REPLAY",...result},status)}catch{return json({success:false,error:"FINANCE_PAYABLE_INSTRUMENT_TRANSITION_PERSISTENCE_FAILED"},503)}
  }

  if (hasCollectionCommand(body)) {
    const decision = decideCollectionServerContract(body, context.scope);
    if (!decision.allowed) {
      return json({ success: false, error: decision.code }, decision.status);
    }
    const access = guardServerFinanceChannelAccess({
      authenticatedUser: {
        id: user.id,
        role: user.role,
        storedPermissions: user.permissions,
        permissionVersion: user.permissionVersion,
        sessionPermissionVersion: user.sessionPermissionVersion
      },
      channel: decision.command.channel,
      operation: decision.operation,
      direction: "CREATE",
      requestedPermission: decision.requestedPermission as never,
      packageType: context.package,
      actorScope: context.scope,
      resourceScope: context.scope,
      customerId: decision.command.customerId
    });
    if (!access.allowed) {
      return json({ success: false, error: "FINANCE_ACCESS_DENIED", reason: access.reasonCode }, 403);
    }
    const serverCommand = {
      ...decision.command,
      tenantId: context.scope.tenantId,
      companyId: context.scope.companyId,
      branchId: context.scope.branchId,
      accountingPeriodId: context.scope.accountingPeriodId
    };
    try {
      const result = await persistFinanceCollectionV1(
        supabaseServer as unknown as CollectionRpcClient,
        serverCommand as unknown as Record<string, unknown>,
        user.id,
        stableFinanceOperationHash(serverCommand)
      );
      const status = result.outcome === "CREATED" ? 201 :
        result.outcome === "REPLAY" ? 200 :
        result.outcome === "CONFLICT" ? 409 : 422;
      return json({ success: result.outcome === "CREATED" || result.outcome === "REPLAY", ...result }, status);
    } catch {
      console.error("[Finance Collection API] Persistence failed.");
      return json({ success: false, error: "FINANCE_COLLECTION_PERSISTENCE_FAILED" }, 503);
    }
  }

  if (hasPosCommand(body)) {
    const decision = decidePosServerAuthorityContract(body, context.scope);

    if (!decision.allowed) {
      return json({ success: false, error: decision.code }, decision.status);
    }

    if (user.role !== "ADMIN") {
      return json({ success: false, error: "FINANCE_POS_ADMIN_REQUIRED" }, 403);
    }

    const serverOperation = {
      ...decision.command,
      tenantId: context.scope.tenantId,
      companyId: context.scope.companyId,
      branchId: context.scope.branchId,
      accountingPeriodId: context.scope.accountingPeriodId
    };

    try {
      const result = await persistFinancePosAuthorityV1(
        supabaseServer as unknown as PosServerAuthorityRpcClient,
        serverOperation as unknown as Record<string, unknown>,
        user.id,
        stableFinanceOperationHash(serverOperation)
      );

      if (result.outcome === "CONFLICT") {
        return json(
          {
            success: false,
            outcome: result.outcome,
            operationId: result.operation_id,
            transactionIds: result.transaction_ids,
            reason: result.reason
          },
          409
        );
      }

      if (result.outcome === "REJECT") {
        return json(
          {
            success: false,
            outcome: result.outcome,
            operationId: result.operation_id,
            transactionIds: result.transaction_ids,
            reason: result.reason
          },
          422
        );
      }

      return json(
        {
          success: true,
          outcome: result.outcome,
          operationId: result.operation_id,
          transactionIds: result.transaction_ids
        },
        result.outcome === "CREATED" ? 201 : 200
      );
    } catch {
      console.error("[Finance POS Authority API] Persistence failed.");
      return json({ success: false, error: "FINANCE_POS_PERSISTENCE_FAILED" }, 503);
    }
  }

  const contract = decideFinanceServerOperationContract(body, context.scope);

  if (!contract.allowed) {
    return json({ success: false, error: contract.code }, contract.status);
  }

  const access = guardServerFinanceChannelAccess({
    authenticatedUser: {
      id: user.id,
      role: user.role,
      storedPermissions: user.permissions,
      permissionVersion: user.permissionVersion,
      sessionPermissionVersion: user.sessionPermissionVersion
    },
    channel: contract.guard.channel,
    operation: contract.guard.operation,
    direction: contract.guard.direction,
    requestedPermission: contract.guard.requestedPermission as never,
    packageType: context.package,
    actorScope: context.scope,
    resourceScope: context.scope,
    customerId: contract.command.source.customerId ?? undefined,
    saleId: contract.command.source.saleId ?? undefined
  });

  if (!access.allowed) {
    return json(
      {
        success: false,
        error: "FINANCE_ACCESS_DENIED",
        reason: access.reasonCode
      },
      403
    );
  }

  const serverOperation = {
    ...contract.command,
    tenantId: context.scope.tenantId,
    companyId: context.scope.companyId,
    branchId: context.scope.branchId,
    accountingPeriodId: context.scope.accountingPeriodId
  };

  const atomicCounterpartyPaymentReverse =
    serverOperation.kind === "PAYMENT" &&
    (serverOperation.channel === "CASH" ||
      serverOperation.channel === "BANK") &&
    serverOperation.action === "REVERSE";

  if (atomicCounterpartyPaymentReverse) {
    const result = await persistFinanceCounterpartyPaymentReversalV1(
      supabaseServer as unknown as FinanceCounterpartyPaymentReversalRpcClient,
      serverOperation as unknown as Record<string, unknown>,
      {
        actorUserId: user.id,
        action: "CREATE",
        occurredAt: serverOperation.occurredAt,
        note: serverOperation.description ?? null
      },
      user.id,
      stableFinanceOperationHash(serverOperation)
    );

    if (result.outcome === "CONFLICT") {
      return NextResponse.json(
        {
          ok: false,
          error: result.reason ?? "FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_CONFLICT",
          operationId: result.operation_id
        },
        { status: 409 }
      );
    }

    if (result.outcome === "REJECT") {
      return NextResponse.json(
        {
          ok: false,
          error: result.reason ?? "FINANCE_COUNTERPARTY_PAYMENT_REVERSAL_REJECTED",
          operationId: result.operation_id
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        outcome: result.outcome,
        operationId: result.operation_id,
        transactionIds: result.transaction_ids,
        movementId: result.movement_id
      },
      {
        status: result.outcome === "CREATED" ? 201 : 200
      }
    );
  }
  const atomicCounterpartyPayment =
    serverOperation.kind === "PAYMENT" &&
    (
      serverOperation.channel === "CASH" ||
      serverOperation.channel === "BANK"
    ) &&
    serverOperation.action === "CREATE";

  const paymentCounterpartyType =
    atomicCounterpartyPayment
      ? readPaymentCounterpartyType(body)
      : null;

  if (
    atomicCounterpartyPayment &&
    (
      !paymentCounterpartyType ||
      !serverOperation.source.counterpartyId ||
      !serverOperation.source.sourceDocumentId
    )
  ) {
    return json(
      {
        success: false,
        error: "FINANCE_COUNTERPARTY_PAYMENT_SOURCE_INVALID"
      },
      422
    );
  }

  if (
    serverOperation.kind === "PAYMENT" &&
    !atomicCounterpartyPayment
  ) {
    return json(
      {
        success: false,
        error: "FINANCE_COUNTERPARTY_PAYMENT_ATOMIC_AUTHORITY_REQUIRED"
      },
      422
    );
  }

  try {
    const result = atomicCounterpartyPayment
      ? await persistFinanceCounterpartyPaymentV1(
          supabaseServer as unknown as FinanceCounterpartyPaymentRpcClient,
          serverOperation as unknown as Record<string, unknown>,
          {
            movementId: `${serverOperation.operationId}:PAYABLE`,
            idempotencyKey: `${serverOperation.idempotencyKey}:PAYABLE`,
            tenantId: context.scope.tenantId,
            companyId: context.scope.companyId,
            branchId: context.scope.branchId,
            accountingPeriodId: context.scope.accountingPeriodId,
            counterpartyCustomerId: serverOperation.source.counterpartyId,
            counterpartyType: paymentCounterpartyType,
            kind: "PAYMENT",
            amount: serverOperation.amount,
            currency: serverOperation.currency,
            occurredAt: serverOperation.occurredAt,
            recordedAt: serverOperation.occurredAt,
            sourceDocumentId: serverOperation.source.sourceDocumentId,
            operationId: serverOperation.operationId,
            sourcePaymentId: serverOperation.operationId,
            note: serverOperation.description || null
          },
          {
            actorUserId: user.id,
            action: "CREATE",
            occurredAt: serverOperation.occurredAt,
            operationId: serverOperation.operationId,
            sourceDocumentId: serverOperation.source.sourceDocumentId
          },
          user.id,
          stableFinanceOperationHash(serverOperation)
        )
      : await persistFinanceOperationV1(
          supabaseServer as unknown as FinanceOperationsRpcClient,
          serverOperation as unknown as Record<string, unknown>,
          user.id,
          stableFinanceOperationHash(serverOperation)
        );

    if (result.outcome === "CONFLICT") {
      return json(
        {
          success: false,
          outcome: result.outcome,
          operationId: result.operation_id,
          transactionIds: result.transaction_ids,
          reason: result.reason
        },
        409
      );
    }

    if (result.outcome === "REJECT") {
      return json(
        {
          success: false,
          outcome: result.outcome,
          operationId: result.operation_id,
          transactionIds: result.transaction_ids,
          reason: result.reason
        },
        422
      );
    }

    return json(
      {
        success: true,
        outcome: result.outcome,
        operationId: result.operation_id,
        transactionIds: result.transaction_ids
      },
      result.outcome === "CREATED" ? 201 : 200
    );
  } catch {
    console.error("[Finance Operations API] Persistence failed.");
    return json({ success: false, error: "FINANCE_OPERATION_PERSISTENCE_FAILED" }, 503);
  }
}
