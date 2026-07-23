import 'fake-indexeddb/auto';

import type {
  Sale,
  SaleInstallment,
  SalePayment
} from '../src/store/salesStore';

import {
  applyPaymentToSale,
  createEqualInstallmentPlan,
  getOverdueInstallments,
  getSaleRemainingBalance,
  resolveInstallmentStatus
} from '../src/lib/salesFinance';

import {
  saleDueNotificationDb,
  listOpenDueNotificationsForUser,
  markSaleDueNotificationShown
} from '../src/lib/saleDueNotificationDb';

import {
  buildSaleDueNotificationSnapshots,
  reconcileSaleDueNotifications
} from '../src/lib/saleDueNotificationEngine';

import {
  normalizeUser
} from '../src/store/useAuthStore';

let failed = false;

async function runTest(
  name: string,
  fn: () => void | Promise<void>
): Promise<void> {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(`[FAIL] ${name} -> ${message}`);
    failed = true;
  }
}

function assert(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createInstallment(
  args: Partial<SaleInstallment> & {
    id: string;
    sequence: number;
    dueDate: string;
    amount: number;
  }
): SaleInstallment {
  return {
    id: args.id,
    sequence: args.sequence,
    dueDate: args.dueDate,
    amount: args.amount,
    paidAmount: args.paidAmount || 0,
    status: args.status || 'BEKLIYOR',
    lastPaymentAt: args.lastPaymentAt,
    note: args.note
  };
}

function createSale(
  overrides: Partial<Sale> = {}
): Sale {
  const now = '2026-07-23T12:00:00.000Z';

  return {
    id: overrides.id || 'sale-1',
    saleNo: overrides.saleNo || 'SAT-0001',
    customerId: overrides.customerId || 'customer-1',
    createdByUserId:
      overrides.createdByUserId || 'sales-user',
    createdByUsername:
      overrides.createdByUsername || 'salesuser',
    createdByName:
      overrides.createdByName || 'Satış Kullanıcısı',
    status: overrides.status || 'ONAYLANDI',
    items: overrides.items || [],
    priceSource: overrides.priceSource || 'MANUAL',
    totalAmount:
      overrides.totalAmount !== undefined
        ? overrides.totalAmount
        : 1000,
    cashPrice:
      overrides.cashPrice !== undefined
        ? overrides.cashPrice
        : 1000,
    installmentPrice:
      overrides.installmentPrice !== undefined
        ? overrides.installmentPrice
        : 1000,
    discount:
      overrides.discount !== undefined
        ? overrides.discount
        : 0,
    downPayment:
      overrides.downPayment !== undefined
        ? overrides.downPayment
        : 0,
    downPaymentMethod: overrides.downPaymentMethod,
    generalDueDate: overrides.generalDueDate,
    remainingBalance:
      overrides.remainingBalance !== undefined
        ? overrides.remainingBalance
        : 1000,
    installmentPlan: overrides.installmentPlan,
    payments: overrides.payments || [],
    customerApproval: overrides.customerApproval,
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    isDeleted: overrides.isDeleted,
    isArchived: overrides.isArchived
  };
}

function createPayment(
  overrides: Partial<SalePayment> = {}
): SalePayment {
  return {
    id: overrides.id || crypto.randomUUID(),
    amount:
      overrides.amount !== undefined
        ? overrides.amount
        : 100,
    paidAt:
      overrides.paidAt ||
      '2026-07-23T12:00:00.000Z',
    method: overrides.method || 'NAKIT',
    installmentId: overrides.installmentId,
    note: overrides.note,
    receivedBy: overrides.receivedBy
  };
}

async function main(): Promise<void> {
  console.log('==================================================');
  console.log(' SALES FINANCE & DUE NOTIFICATION TEST SUITE');
  console.log('==================================================\n');

  await saleDueNotificationDb.notifications.clear();

  await runTest(
    'equalInstallmentPlanPreservesExactTotal',
    () => {
      const plan = createEqualInstallmentPlan({
        totalAmount: 1000,
        installmentCount: 3,
        firstDueDate: '2026-08-01'
      });

      const total = plan.installments.reduce(
        (sum, installment) =>
          Number(
            (
              sum + installment.amount
            ).toFixed(2)
          ),
        0
      );

      assert(
        total === 1000,
        `Expected 1000, got ${total}`
      );

      assert(
        plan.installments[0].amount === 333.33,
        'First installment mismatch'
      );

      assert(
        plan.installments[2].amount === 333.34,
        'Last installment must absorb rounding difference'
      );
    }
  );

  await runTest(
    'paymentDefaultsToOldestOpenInstallment',
    () => {
      const sale = createSale({
        installmentPlan: {
          id: 'plan-1',
          createdAt: '2026-07-01T00:00:00.000Z',
          firstDueDate: '2026-08-01',
          installmentCount: 2,
          frequency: 'MONTHLY',
          totalPlannedAmount: 1000,
          installments: [
            createInstallment({
              id: 'late-second-in-array',
              sequence: 2,
              dueDate: '2026-09-01',
              amount: 500
            }),
            createInstallment({
              id: 'oldest',
              sequence: 1,
              dueDate: '2026-08-01',
              amount: 500
            })
          ]
        }
      });

      const updated = applyPaymentToSale(
        sale,
        createPayment({ amount: 200 })
      );

      const oldest =
        updated.installmentPlan?.installments.find(
          installment => installment.id === 'oldest'
        );

      const later =
        updated.installmentPlan?.installments.find(
          installment =>
            installment.id === 'late-second-in-array'
        );

      assert(
        oldest?.paidAmount === 200,
        'Payment was not allocated to oldest installment'
      );

      assert(
        later?.paidAmount === 0,
        'Later installment was modified unexpectedly'
      );
    }
  );

  await runTest(
    'selectedInstallmentReceivesPaymentFirstThenOverflowContinues',
    () => {
      const sale = createSale({
        installmentPlan: {
          id: 'plan-selected',
          createdAt: '2026-07-01T00:00:00.000Z',
          firstDueDate: '2026-08-01',
          installmentCount: 2,
          frequency: 'MONTHLY',
          totalPlannedAmount: 1000,
          installments: [
            createInstallment({
              id: 'first',
              sequence: 1,
              dueDate: '2026-08-01',
              amount: 500
            }),
            createInstallment({
              id: 'second',
              sequence: 2,
              dueDate: '2026-09-01',
              amount: 500
            })
          ]
        }
      });

      const updated = applyPaymentToSale(
        sale,
        createPayment({
          amount: 700,
          installmentId: 'second'
        })
      );

      const first =
        updated.installmentPlan?.installments.find(
          installment => installment.id === 'first'
        );

      const second =
        updated.installmentPlan?.installments.find(
          installment => installment.id === 'second'
        );

      assert(
        second?.paidAmount === 500,
        'Selected installment was not closed first'
      );

      assert(
        second?.status === 'ODENDI',
        'Selected installment status is not ODENDI'
      );

      assert(
        first?.paidAmount === 200,
        'Overflow was not allocated to remaining installment'
      );
    }
  );

  await runTest(
    'paymentCannotExceedSaleBalance',
    () => {
      const sale = createSale({
        totalAmount: 500,
        remainingBalance: 500
      });

      let rejected = false;

      try {
        applyPaymentToSale(
          sale,
          createPayment({ amount: 500.01 })
        );
      } catch (error) {
        rejected =
          error instanceof Error &&
          error.message.includes(
            'açık bakiyesini aşamaz'
          );
      }

      assert(
        rejected,
        'Overpayment was not rejected'
      );
    }
  );

  await runTest(
    'selectedClosedInstallmentIsRejected',
    () => {
      const sale = createSale({
        totalAmount: 1000,
        installmentPlan: {
          id: 'plan-closed',
          createdAt: '2026-07-01T00:00:00.000Z',
          firstDueDate: '2026-08-01',
          installmentCount: 2,
          frequency: 'MONTHLY',
          totalPlannedAmount: 1000,
          installments: [
            createInstallment({
              id: 'closed',
              sequence: 1,
              dueDate: '2026-08-01',
              amount: 500,
              paidAmount: 500,
              status: 'ODENDI'
            }),
            createInstallment({
              id: 'open',
              sequence: 2,
              dueDate: '2026-09-01',
              amount: 500
            })
          ]
        }
      });

      let rejected = false;

      try {
        applyPaymentToSale(
          sale,
          createPayment({
            amount: 100,
            installmentId: 'closed'
          })
        );
      } catch (error) {
        rejected =
          error instanceof Error &&
          error.message.includes(
            'bulunamadı veya kapanmış'
          );
      }

      assert(
        rejected,
        'Closed installment selection was not rejected'
      );
    }
  );

  await runTest(
    'installmentStatusesAreDeterministic',
    () => {
      const overdue = createInstallment({
        id: 'overdue',
        sequence: 1,
        dueDate: '2026-06-01',
        amount: 100
      });

      const partial = {
        ...overdue,
        paidAmount: 20
      };

      const paid = {
        ...overdue,
        paidAmount: 100
      };

      assert(
        resolveInstallmentStatus(
          overdue,
          '2026-07-23'
        ) === 'GECIKTI',
        'Overdue status mismatch'
      );

      assert(
        resolveInstallmentStatus(
          partial,
          '2026-07-23'
        ) === 'KISMI_ODENDI',
        'Partial status mismatch'
      );

      assert(
        resolveInstallmentStatus(
          paid,
          '2026-07-23'
        ) === 'ODENDI',
        'Paid status mismatch'
      );
    }
  );

  await runTest(
    'paidInstallmentIsNotReturnedAsOverdue',
    () => {
      const sale = createSale({
        installmentPlan: {
          id: 'plan-overdue',
          createdAt: '2026-01-01T00:00:00.000Z',
          firstDueDate: '2026-05-01',
          installmentCount: 2,
          frequency: 'MONTHLY',
          totalPlannedAmount: 200,
          installments: [
            createInstallment({
              id: 'paid',
              sequence: 1,
              dueDate: '2026-05-01',
              amount: 100,
              paidAmount: 100,
              status: 'ODENDI'
            }),
            createInstallment({
              id: 'open-overdue',
              sequence: 2,
              dueDate: '2026-06-01',
              amount: 100
            })
          ]
        }
      });

      const overdue = getOverdueInstallments(
        sale,
        '2026-07-23'
      );

      assert(
        overdue.length === 1,
        `Expected 1 overdue installment, got ${overdue.length}`
      );

      assert(
        overdue[0].id === 'open-overdue',
        'Wrong installment returned as overdue'
      );
    }
  );

  await runTest(
    'sameCustomerSalesRemainFinanciallySeparate',
    () => {
      const saleA = createSale({
        id: 'sale-a',
        saleNo: 'SAT-A',
        customerId: 'same-customer',
        totalAmount: 1000
      });

      const saleB = createSale({
        id: 'sale-b',
        saleNo: 'SAT-B',
        customerId: 'same-customer',
        totalAmount: 2000,
        remainingBalance: 2000
      });

      const updatedA = applyPaymentToSale(
        saleA,
        createPayment({ amount: 300 })
      );

      assert(
        getSaleRemainingBalance(updatedA) === 700,
        'Sale A remaining balance mismatch'
      );

      assert(
        getSaleRemainingBalance(saleB) === 2000,
        'Sale B was mutated by Sale A payment'
      );

      assert(
        (saleB.payments || []).length === 0,
        'Sale B payment list was mutated'
      );
    }
  );

  await runTest(
    'notificationSnapshotsKeepSalesSeparate',
    () => {
      const users = [
        normalizeUser({
          id: 'admin-1',
          role: 'ADMIN',
          isActive: true
        }),
        normalizeUser({
          id: 'sales-user',
          role: 'OFFICE',
          isActive: true
        })
      ];

      const sales = [
        createSale({
          id: 'sale-a',
          saleNo: 'SAT-A',
          customerId: 'same-customer',
          generalDueDate: '2026-07-20'
        }),
        createSale({
          id: 'sale-b',
          saleNo: 'SAT-B',
          customerId: 'same-customer',
          generalDueDate: '2026-07-21'
        })
      ];

      const records =
        buildSaleDueNotificationSnapshots({
          sales,
          users,
          customers: [
            {
              id: 'same-customer',
              name: 'Aynı Cari'
            }
          ],
          now: new Date(
            '2026-07-23T12:00:00.000Z'
          )
        });

      assert(
        records.length === 2,
        `Expected 2 notifications, got ${records.length}`
      );

      assert(
        records[0].saleId !== records[1].saleId,
        'Different sales were merged'
      );

      assert(
        records[0].id !== records[1].id,
        'Notification IDs collided'
      );
    }
  );

  await runTest(
    'inactiveFinancialSalesAreExcluded',
    () => {
      const users = [
        normalizeUser({
          id: 'admin-1',
          role: 'ADMIN',
          isActive: true
        })
      ];

      const excludedSales = [
        createSale({
          id: 'draft',
          status: 'TASLAK',
          generalDueDate: '2026-07-20'
        }),
        createSale({
          id: 'offer',
          status: 'TEKLİF',
          generalDueDate: '2026-07-20'
        }),
        createSale({
          id: 'cancelled',
          status: 'İPTAL',
          generalDueDate: '2026-07-20'
        }),
        createSale({
          id: 'archived',
          isArchived: true,
          generalDueDate: '2026-07-20'
        }),
        createSale({
          id: 'deleted',
          isDeleted: true,
          generalDueDate: '2026-07-20'
        })
      ];

      const records =
        buildSaleDueNotificationSnapshots({
          sales: excludedSales,
          users,
          customers: [],
          now: new Date(
            '2026-07-23T12:00:00.000Z'
          )
        });

      assert(
        records.length === 0,
        `Excluded sales generated ${records.length} notifications`
      );
    }
  );

  await runTest(
    'notificationTargetsOwnerAndActiveAdmins',
    () => {
      const users = [
        normalizeUser({
          id: 'admin-active',
          role: 'ADMIN',
          isActive: true
        }),
        normalizeUser({
          id: 'admin-inactive',
          role: 'ADMIN',
          isActive: false
        }),
        normalizeUser({
          id: 'sales-user',
          role: 'OFFICE',
          isActive: true
        })
      ];

      const records =
        buildSaleDueNotificationSnapshots({
          sales: [
            createSale({
              createdByUserId: 'sales-user',
              generalDueDate: '2026-07-20'
            })
          ],
          users,
          customers: [],
          now: new Date(
            '2026-07-23T12:00:00.000Z'
          )
        });

      assert(
        records.length === 1,
        'Expected one due notification'
      );

      const targets = records[0].targetUserIds;

      assert(
        targets.includes('sales-user'),
        'Sale owner is missing'
      );

      assert(
        targets.includes('admin-active'),
        'Active admin is missing'
      );

      assert(
        !targets.includes('admin-inactive'),
        'Inactive admin must not receive notification'
      );
    }
  );

  await runTest(
    'reconcileClosesResolvedNotification',
    async () => {
      await saleDueNotificationDb.notifications.clear();

      const users = [
        normalizeUser({
          id: 'admin-1',
          role: 'ADMIN',
          isActive: true
        })
      ];

      const openSale = createSale({
        id: 'sale-close-test',
        saleNo: 'SAT-CLOSE',
        generalDueDate: '2026-07-20',
        totalAmount: 500,
        remainingBalance: 500
      });

      await reconcileSaleDueNotifications({
        sales: [openSale],
        users,
        customers: [],
        now: new Date(
          '2026-07-23T08:00:00.000Z'
        )
      });

      const paidSale = createSale({
        ...openSale,
        payments: [
          createPayment({
            id: 'payment-full',
            amount: 500
          })
        ],
        remainingBalance: 0
      });

      await reconcileSaleDueNotifications({
        sales: [paidSale],
        users,
        customers: [],
        now: new Date(
          '2026-07-23T09:00:00.000Z'
        )
      });

      const records =
        await saleDueNotificationDb.notifications
          .where('saleId')
          .equals('sale-close-test')
          .toArray();

      assert(
        records.length === 1,
        `Expected one persisted record, got ${records.length}`
      );

      assert(
        records[0].status === 'CLOSED',
        'Resolved notification was not closed'
      );

      assert(
        records[0].openAmount === 0,
        'Closed notification open amount is not zero'
      );
    }
  );

  await runTest(
    'dailyShownMarkerIsPreservedPerUser',
    async () => {
      await saleDueNotificationDb.notifications.clear();

      const users = [
        normalizeUser({
          id: 'admin-1',
          role: 'ADMIN',
          isActive: true
        })
      ];

      await reconcileSaleDueNotifications({
        sales: [
          createSale({
            id: 'sale-shown',
            saleNo: 'SAT-SHOWN',
            generalDueDate: '2026-07-20'
          })
        ],
        users,
        customers: [],
        now: new Date(
          '2026-07-23T08:00:00.000Z'
        )
      });

      const open =
        await listOpenDueNotificationsForUser(
          'admin-1',
          '2026-07-23'
        );

      assert(
        open.length === 1,
        'Open notification could not be listed'
      );

      await markSaleDueNotificationShown(
        open[0].id,
        'admin-1',
        '2026-07-23'
      );

      const stored =
        await saleDueNotificationDb.notifications
          .get(open[0].id);

      assert(
        stored?.lastNotifiedOnByUser?.['admin-1'] ===
          '2026-07-23',
        'Daily shown marker was not stored'
      );
    }
  );

  await saleDueNotificationDb.notifications.clear();

  console.log('\n==================================================');

  if (failed) {
    console.error(
      ' SALES FINANCE TEST SUITE FAILED!'
    );

    process.exitCode = 1;
    return;
  }

  console.log(
    ' ALL SALES FINANCE TESTS PASSED SUCCESSFULLY!'
  );
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});