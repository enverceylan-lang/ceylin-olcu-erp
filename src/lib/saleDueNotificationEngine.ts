import type {
  Sale,
  SaleInstallment
} from '@/store/salesStore';
import type {
  MockUser
} from '@/store/useAuthStore';
import {
  normalizeRole
} from '@/store/useAuthStore';
import {
  getSaleRemainingBalance
} from '@/lib/salesFinance';
import {
  loadSaleDueNotifications,
  saveSaleDueNotifications,
  type SaleDueNotification
} from '@/lib/saleDueNotificationDb';

interface NotificationCustomer {
  id: string;
  name?: string;
}

interface BuildSaleDueNotificationArgs {
  sales: Sale[];
  users: MockUser[];
  customers: NotificationCustomer[];
  now?: Date;
}

const roundMoney = (value: number): number =>
  Number(Number(value || 0).toFixed(2));

function isFinanciallyActiveSale(
  sale: Sale
): boolean {
  return (
    !sale.isDeleted &&
    !sale.isArchived &&
    sale.status !== 'TASLAK' &&
    sale.status !== 'TEKLİF' &&
    sale.status !== 'İPTAL'
  );
}

function getTargetUserIds(
  sale: Sale,
  users: MockUser[]
): string[] {
  const ids = new Set<string>();

  if (sale.createdByUserId) {
    ids.add(sale.createdByUserId);
  }

  users
    .filter(user =>
      user.isActive &&
      normalizeRole(user.role) === 'ADMIN'
    )
    .forEach(user => ids.add(user.id));

  return [...ids];
}

function buildGeneralNotificationId(
  sale: Sale
): string {
  return [
    'SALE_GENERAL',
    sale.id,
    sale.generalDueDate
  ].join(':');
}

function buildInstallmentNotificationId(
  sale: Sale,
  installment: SaleInstallment
): string {
  return [
    'SALE_INSTALLMENT',
    sale.id,
    installment.id,
    installment.dueDate
  ].join(':');
}

export function buildSaleDueNotificationSnapshots(
  args: BuildSaleDueNotificationArgs
): SaleDueNotification[] {
  const now = args.now || new Date();
  const nowText = now.toISOString();
  const customerNames = new Map(
    args.customers.map(customer => [
      customer.id,
      customer.name || 'Bilinmeyen Müşteri'
    ])
  );

  const notifications: SaleDueNotification[] = [];

  for (const sale of args.sales) {
    if (!isFinanciallyActiveSale(sale)) {
      continue;
    }

    const targetUserIds =
      getTargetUserIds(sale, args.users);

    if (targetUserIds.length === 0) {
      continue;
    }

    const customerName =
      customerNames.get(sale.customerId) ||
      'Bilinmeyen Müşteri';

    const saleOpenAmount =
      getSaleRemainingBalance(sale);

    if (
      sale.generalDueDate &&
      saleOpenAmount > 0
    ) {
      notifications.push({
        id: buildGeneralNotificationId(sale),
        sourceType: 'GENERAL',
        saleId: sale.id,
        customerId: sale.customerId,
        saleNo: sale.saleNo,
        customerName,
        dueDate: sale.generalDueDate,
        amount: saleOpenAmount,
        openAmount: saleOpenAmount,
        targetUserIds,
        status: 'OPEN',
        createdAt: nowText,
        updatedAt: nowText
      });
    }

    for (
      const installment of
        sale.installmentPlan?.installments || []
    ) {
      if (installment.status === 'IPTAL') {
        continue;
      }

      const openAmount = roundMoney(
        installment.amount -
          installment.paidAmount
      );

      if (openAmount <= 0) {
        continue;
      }

      notifications.push({
        id: buildInstallmentNotificationId(
          sale,
          installment
        ),
        sourceType: 'INSTALLMENT',
        saleId: sale.id,
        installmentId: installment.id,
        customerId: sale.customerId,
        saleNo: sale.saleNo,
        customerName,
        dueDate: installment.dueDate,
        amount: roundMoney(installment.amount),
        openAmount,
        targetUserIds,
        status: 'OPEN',
        createdAt: nowText,
        updatedAt: nowText
      });
    }
  }

  return notifications;
}

export async function reconcileSaleDueNotifications(
  args: BuildSaleDueNotificationArgs
): Promise<SaleDueNotification[]> {
  const nowText =
    (args.now || new Date()).toISOString();

  const expected =
    buildSaleDueNotificationSnapshots(args);

  const existing =
    await loadSaleDueNotifications();

  const expectedById = new Map(
    expected.map(notification => [
      notification.id,
      notification
    ])
  );

  const existingById = new Map(
    existing.map(notification => [
      notification.id,
      notification
    ])
  );

  const recordsToSave: SaleDueNotification[] = [];

  for (const expectedRecord of expected) {
    const previous =
      existingById.get(expectedRecord.id);

    recordsToSave.push({
      ...expectedRecord,
      createdAt:
        previous?.createdAt ||
        expectedRecord.createdAt,
      lastNotifiedOnByUser:
        previous?.lastNotifiedOnByUser,
      status: 'OPEN',
      closedAt: undefined,
      updatedAt: nowText
    });
  }

  for (const previous of existing) {
    if (expectedById.has(previous.id)) {
      continue;
    }

    if (previous.status === 'CLOSED') {
      continue;
    }

    recordsToSave.push({
      ...previous,
      status: 'CLOSED',
      openAmount: 0,
      closedAt: nowText,
      updatedAt: nowText
    });
  }

  await saveSaleDueNotifications(
    recordsToSave
  );

  return recordsToSave;
}
