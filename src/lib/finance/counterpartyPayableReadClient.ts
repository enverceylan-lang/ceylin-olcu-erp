import type {
  CounterpartyPayableMovement
} from "@/lib/counterpartyPayableService";

import type {
  ErpScope
} from "@/lib/erpScope";

interface CounterpartyReadResponse {
  success?:
    boolean;
  error?:
    string;
  scope?:
    ErpScope;
  movements?:
    CounterpartyPayableMovement[];
}

function sameScope(
  left:
    ErpScope,
  right:
    ErpScope
): boolean {
  return (
    left.tenantId ===
      right.tenantId &&
    left.companyId ===
      right.companyId &&
    left.branchId ===
      right.branchId &&
    left.accountingPeriodId ===
      right.accountingPeriodId
  );
}

export async function fetchCounterpartyPayableMovements(
  scope:
    ErpScope
): Promise<
  CounterpartyPayableMovement[]
> {
  const response =
    await fetch(
      "/api/finance/counterparty/movements",
      {
        method:
          "GET",
        credentials:
          "same-origin",
        cache:
          "no-store"
      }
    );

  const body =
    (
      await response
        .json()
        .catch(
          () =>
            null
        )
    ) as
      CounterpartyReadResponse
      | null;

  if (
    !response.ok ||
    !body?.success ||
    !body.scope ||
    !Array.isArray(
      body.movements
    )
  ) {
    throw new Error(
      body?.error ||
      "COUNTERPARTY_PAYABLE_READ_API_FAILED"
    );
  }

  if (
    !sameScope(
      scope,
      body.scope
    )
  ) {
    throw new Error(
      "COUNTERPARTY_PAYABLE_READ_SCOPE_MISMATCH"
    );
  }

  return body.movements;
}