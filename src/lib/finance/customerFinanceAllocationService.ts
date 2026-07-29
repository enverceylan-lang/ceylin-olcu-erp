import type {
  CustomerFinanceAllocationCommand,
  CustomerFinanceAllocationLine,
  CustomerFinanceAllocationPlan,
  CustomerOpenItem
} from "@/lib/finance/cashFinanceContracts";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sameScope(
  command: CustomerFinanceAllocationCommand,
  item: CustomerOpenItem
): boolean {
  return (
    command.tenantId === item.tenantId &&
    command.companyId === item.companyId &&
    command.branchId === item.branchId &&
    command.accountingPeriodId ===
      item.accountingPeriodId
  );
}

function assertCommand(
  command: CustomerFinanceAllocationCommand
): void {
  if (command.customerId.trim().length === 0) {
    throw new Error(
      "CUSTOMER_ALLOCATION_CUSTOMER_REQUIRED"
    );
  }

  if (command.currency.trim().length === 0) {
    throw new Error(
      "CUSTOMER_ALLOCATION_CURRENCY_REQUIRED"
    );
  }

  if (
    !Number.isFinite(command.amount) ||
    command.amount <= 0
  ) {
    throw new Error(
      "CUSTOMER_ALLOCATION_AMOUNT_INVALID"
    );
  }

  const ids =
    new Set<string>();

  for (const item of command.openItems) {
    if (ids.has(item.id)) {
      throw new Error(
        "CUSTOMER_ALLOCATION_OPEN_ITEM_DUPLICATE"
      );
    }

    ids.add(item.id);

    if (!sameScope(command, item)) {
      throw new Error(
        "CUSTOMER_ALLOCATION_SCOPE_MISMATCH"
      );
    }

    if (
      item.customerId !==
      command.customerId
    ) {
      throw new Error(
        "CUSTOMER_ALLOCATION_CUSTOMER_MISMATCH"
      );
    }

    if (
      item.currency !==
      command.currency
    ) {
      throw new Error(
        "CUSTOMER_ALLOCATION_CURRENCY_MISMATCH"
      );
    }

    if (
      !Number.isFinite(item.openAmount) ||
      item.openAmount < 0
    ) {
      throw new Error(
        "CUSTOMER_ALLOCATION_OPEN_AMOUNT_INVALID"
      );
    }
  }

  if (
    command.preferredOpenItemId &&
    !ids.has(command.preferredOpenItemId)
  ) {
    throw new Error(
      "CUSTOMER_ALLOCATION_PREFERRED_ITEM_NOT_FOUND"
    );
  }
}

export function createCustomerFinanceAllocationPlan(
  command: CustomerFinanceAllocationCommand
): CustomerFinanceAllocationPlan {
  assertCommand(command);

  const preferred =
    command.preferredOpenItemId
      ? command.openItems.find(
          item =>
            item.id ===
            command.preferredOpenItemId
        )
      : undefined;

  const remainingItems =
    command.openItems
      .filter(
        item =>
          item.openAmount > 0 &&
          item.id !==
            command.preferredOpenItemId
      )
      .sort(
        (left, right) =>
          left.dueDate.localeCompare(
            right.dueDate
          ) ||
          left.documentNumber.localeCompare(
            right.documentNumber
          ) ||
          left.id.localeCompare(
            right.id
          )
      );

  const orderedItems =
    preferred && preferred.openAmount > 0
      ? [preferred, ...remainingItems]
      : remainingItems;

  let remainingAmount =
    roundMoney(command.amount);

  const lines:
    CustomerFinanceAllocationLine[] = [];

  for (const item of orderedItems) {
    if (remainingAmount <= 0) {
      break;
    }

    const allocatedAmount =
      roundMoney(
        Math.min(
          item.openAmount,
          remainingAmount
        )
      );

    if (allocatedAmount <= 0) {
      continue;
    }

    const remainingOpenAmount =
      roundMoney(
        item.openAmount -
        allocatedAmount
      );

    lines.push({
      openItemId: item.id,

      saleId: item.saleId,
      installmentId:
        item.installmentId,

      documentNumber:
        item.documentNumber,

      dueDate:
        item.dueDate,

      allocatedAmount,
      remainingOpenAmount
    });

    remainingAmount =
      roundMoney(
        remainingAmount -
        allocatedAmount
      );
  }

  const allocatedAmount =
    roundMoney(
      lines.reduce(
        (total, line) =>
          total +
          line.allocatedAmount,
        0
      )
    );

  return {
    customerId:
      command.customerId,

    currency:
      command.currency,

    requestedAmount:
      roundMoney(command.amount),

    allocatedAmount,

    unappliedAmount:
      roundMoney(
        command.amount -
        allocatedAmount
      ),

    lines
  };
}
