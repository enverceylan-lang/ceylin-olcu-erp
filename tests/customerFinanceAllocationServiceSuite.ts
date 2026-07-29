import type {
  CustomerFinanceAllocationCommand,
  CustomerOpenItem
} from "@/lib/finance/cashFinanceContracts";
import {
  createCustomerFinanceAllocationPlan
} from "@/lib/finance/customerFinanceAllocationService";

function assertEqual<T>(
  actual: T,
  expected: T,
  message: string
): void {
  if (actual !== expected) {
    throw new Error(
      message +
        " | expected=" +
        String(expected) +
        " actual=" +
        String(actual)
    );
  }
}

function assertThrows(
  action: () => unknown,
  expectedMessage: string,
  message: string
): void {
  let actualMessage = "";

  try {
    action();
  } catch (error) {
    actualMessage =
      error instanceof Error
        ? error.message
        : String(error);
  }

  assertEqual(
    actualMessage,
    expectedMessage,
    message
  );
}

const scope = {
  tenantId: "tenant-1",
  companyId: "company-1",
  branchId: "branch-1",
  accountingPeriodId: "period-2026"
};

function openItem(
  overrides: Partial<CustomerOpenItem> = {}
): CustomerOpenItem {
  const base: CustomerOpenItem = {
    ...scope,

    id: "open-item-1",
    customerId: "customer-1",

    saleId: "sale-1",
    installmentId: "installment-1",

    documentNumber: "SAT-0001",
    dueDate: "2026-07-10",

    currency: "TRY",
    openAmount: 500
  };

  return {
    ...base,
    ...overrides
  };
}

function command(
  overrides: Partial<CustomerFinanceAllocationCommand> = {}
): CustomerFinanceAllocationCommand {
  const base: CustomerFinanceAllocationCommand = {
    ...scope,

    customerId: "customer-1",
    currency: "TRY",
    amount: 900,

    openItems: [
      openItem(),
      openItem({
        id: "open-item-2",
        saleId: "sale-2",
        installmentId: "installment-2",
        documentNumber: "SAT-0002",
        dueDate: "2026-07-20",
        openAmount: 600
      }),
      openItem({
        id: "open-item-3",
        saleId: "sale-3",
        installmentId: "installment-3",
        documentNumber: "SAT-0003",
        dueDate: "2026-08-01",
        openAmount: 700
      })
    ]
  };

  return {
    ...base,
    ...overrides
  };
}

function runSuite(): void {
  const oldestFirst =
    createCustomerFinanceAllocationPlan(
      command()
    );

  assertEqual(
    oldestFirst.requestedAmount,
    900,
    "Talep tutarı yanlış"
  );

  assertEqual(
    oldestFirst.allocatedAmount,
    900,
    "Dağıtılan tutar yanlış"
  );

  assertEqual(
    oldestFirst.unappliedAmount,
    0,
    "Dağıtılmamış tutar yanlış"
  );

  assertEqual(
    oldestFirst.lines.length,
    2,
    "En eski iki açık kalem kapanmalı"
  );

  assertEqual(
    oldestFirst.lines[0]?.openItemId,
    "open-item-1",
    "En eski taksit önce kapanmadı"
  );

  assertEqual(
    oldestFirst.lines[0]?.allocatedAmount,
    500,
    "İlk taksit dağıtımı yanlış"
  );

  assertEqual(
    oldestFirst.lines[0]?.remainingOpenAmount,
    0,
    "İlk taksit kapanmadı"
  );

  assertEqual(
    oldestFirst.lines[1]?.openItemId,
    "open-item-2",
    "İkinci taksit seçimi yanlış"
  );

  assertEqual(
    oldestFirst.lines[1]?.allocatedAmount,
    400,
    "İkinci taksit dağıtımı yanlış"
  );

  assertEqual(
    oldestFirst.lines[1]?.remainingOpenAmount,
    200,
    "İkinci taksit kalan tutarı yanlış"
  );

  const preferredFirst =
    createCustomerFinanceAllocationPlan(
      command({
        amount: 800,
        preferredOpenItemId:
          "open-item-3"
      })
    );

  assertEqual(
    preferredFirst.lines[0]?.openItemId,
    "open-item-3",
    "Seçili taksit önce kapanmadı"
  );

  assertEqual(
    preferredFirst.lines[0]?.allocatedAmount,
    700,
    "Seçili taksit dağıtımı yanlış"
  );

  assertEqual(
    preferredFirst.lines[1]?.openItemId,
    "open-item-1",
    "Seçili taksit sonrası en eski takside geçilmedi"
  );

  assertEqual(
    preferredFirst.lines[1]?.allocatedAmount,
    100,
    "Seçili taksit sonrası taşan tutar yanlış"
  );

  const excess =
    createCustomerFinanceAllocationPlan(
      command({
        amount: 2500
      })
    );

  assertEqual(
    excess.allocatedAmount,
    1800,
    "Toplam açık tutar yanlış"
  );

  assertEqual(
    excess.unappliedAmount,
    700,
    "Fazla tahsilat ayrılmadı"
  );

  assertEqual(
    excess.lines.length,
    3,
    "Bütün açık kalemler kapanmalı"
  );

  assertThrows(
    () =>
      createCustomerFinanceAllocationPlan(
        command({
          amount: 0
        })
      ),
    "CUSTOMER_ALLOCATION_AMOUNT_INVALID",
    "Sıfır dağıtım tutarı reddedilmedi"
  );

  assertThrows(
    () =>
      createCustomerFinanceAllocationPlan(
        command({
          preferredOpenItemId:
            "missing-item"
        })
      ),
    "CUSTOMER_ALLOCATION_PREFERRED_ITEM_NOT_FOUND",
    "Bulunmayan seçili taksit reddedilmedi"
  );

  assertThrows(
    () =>
      createCustomerFinanceAllocationPlan(
        command({
          openItems: [
            openItem(),
            openItem({
              companyId: "company-2",
              id: "wrong-company"
            })
          ]
        })
      ),
    "CUSTOMER_ALLOCATION_SCOPE_MISMATCH",
    "Başka şirket açık kalemi reddedilmedi"
  );

  assertThrows(
    () =>
      createCustomerFinanceAllocationPlan(
        command({
          openItems: [
            openItem({
              customerId: "customer-2"
            })
          ]
        })
      ),
    "CUSTOMER_ALLOCATION_CUSTOMER_MISMATCH",
    "Başka cari açık kalemi reddedilmedi"
  );

  assertThrows(
    () =>
      createCustomerFinanceAllocationPlan(
        command({
          openItems: [
            openItem({
              currency: "USD"
            })
          ]
        })
      ),
    "CUSTOMER_ALLOCATION_CURRENCY_MISMATCH",
    "Başka para birimi açık kalemi reddedilmedi"
  );

  assertThrows(
    () =>
      createCustomerFinanceAllocationPlan(
        command({
          openItems: [
            openItem(),
            openItem()
          ]
        })
      ),
    "CUSTOMER_ALLOCATION_OPEN_ITEM_DUPLICATE",
    "Mükerrer açık kalem reddedilmedi"
  );

  console.log(
    "CUSTOMER_FINANCE_ALLOCATION_TEST: PAK"
  );
}

runSuite();
