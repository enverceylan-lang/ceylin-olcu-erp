import Dexie, { type Table } from 'dexie';

export type SaleDueSourceType =
  | 'GENERAL'
  | 'INSTALLMENT';

export type SaleDueNotificationStatus =
  | 'OPEN'
  | 'CLOSED';

export interface SaleDueNotification {
  id: string;
  sourceType: SaleDueSourceType;
  saleId: string;
  installmentId?: string;
  customerId: string;
  saleNo: string;
  customerName: string;
  dueDate: string;
  amount: number;
  openAmount: number;
  targetUserIds: string[];
  status: SaleDueNotificationStatus;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  lastNotifiedOnByUser?: Record<string, string>;
}

class SaleDueNotificationDatabase extends Dexie {
  notifications!: Table<
    SaleDueNotification,
    string
  >;

  constructor() {
    super('CeylinSaleDueNotificationDb');

    this.version(1).stores({
      notifications:
        'id, status, dueDate, saleId, customerId, sourceType'
    });
  }
}

export const saleDueNotificationDb =
  new SaleDueNotificationDatabase();

export async function loadSaleDueNotifications():
Promise<SaleDueNotification[]> {
  return saleDueNotificationDb.notifications
    .toArray();
}

export async function saveSaleDueNotifications(
  notifications: SaleDueNotification[]
): Promise<void> {
  if (notifications.length === 0) return;

  await saleDueNotificationDb.notifications
    .bulkPut(notifications);
}

export async function listOpenDueNotificationsForUser(
  userId: string,
  todayText = new Date()
    .toISOString()
    .slice(0, 10)
): Promise<SaleDueNotification[]> {
  const openNotifications =
    await saleDueNotificationDb.notifications
      .where('status')
      .equals('OPEN')
      .toArray();

  return openNotifications
    .filter(notification =>
      notification.dueDate <= todayText &&
      notification.targetUserIds.includes(userId)
    )
    .sort((left, right) => {
      const dateCompare =
        left.dueDate.localeCompare(
          right.dueDate
        );

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return left.saleNo.localeCompare(
        right.saleNo,
        'tr'
      );
    });
}

export async function markSaleDueNotificationShown(
  notificationId: string,
  userId: string,
  shownOn: string
): Promise<void> {
  const notification =
    await saleDueNotificationDb.notifications
      .get(notificationId);

  if (!notification) return;

  await saleDueNotificationDb.notifications.put({
    ...notification,
    lastNotifiedOnByUser: {
      ...(notification.lastNotifiedOnByUser || {}),
      [userId]: shownOn
    },
    updatedAt: new Date().toISOString()
  });
}

export async function deleteSaleDueNotificationsForSale(
  saleId: string
): Promise<void> {
  const records =
    await saleDueNotificationDb.notifications
      .where('saleId')
      .equals(saleId)
      .toArray();

  await saleDueNotificationDb.notifications
    .bulkDelete(
      records.map(record => record.id)
    );
}
