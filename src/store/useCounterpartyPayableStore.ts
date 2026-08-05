import {
  create
} from "zustand";

import {
  persist
} from "zustand/middleware";

import {
  calculateCounterpartyPayableBalance,
  createCounterpartyPayableMovement,
  registerCounterpartyPayment,
  reverseCounterpartyPayableMovement,
  type CounterpartyPayableMovement,
  type CounterpartyPayableResult
} from "@/lib/counterpartyPayableService";

import type {
  ErpScope
} from "@/lib/erpScope";

import {
  enqueueAndAttemptCounterpartyPayablePersistence,
  listCounterpartyPayableOutbox
} from "@/lib/finance/counterpartyPayableOutbox";

import {
  fetchCounterpartyPayableMovements
} from "@/lib/finance/counterpartyPayableReadClient";

interface CounterpartyPayableStore {
  movements:
    CounterpartyPayableMovement[];

  registerAccrual(
    request:
      CounterpartyPayableMovement
  ): CounterpartyPayableResult;

  registerPayment(
    request:
      Omit<
        CounterpartyPayableMovement,
        "kind"
      >
  ): CounterpartyPayableResult;

  reverseMovement(
    request: {
      scope:
        ErpScope;
      sourceMovementId:
        string;
      reversalMovementId:
        string;
      idempotencyKey:
        string;
      occurredAt:
        string;
      recordedAt:
        string;
      note?: string;
    }
  ): CounterpartyPayableResult;

  getBalance(
    scope:
      ErpScope,
    counterpartyCustomerId:
      string
  ): number;

  rehydrateFromServer(
    scope:
      ErpScope
  ): Promise<void>;
}

function queueResultMovement(
  result:
    CounterpartyPayableResult
): void {
  if (
    result.outcome ===
      "CREATED" ||
    result.outcome ===
      "REPLAY"
  ) {
    enqueueAndAttemptCounterpartyPayablePersistence(
      result.movement
    );
  }
}

export const useCounterpartyPayableStore =
  create<CounterpartyPayableStore>()(
    persist(
      (
        set,
        get
      ) => ({
        movements: [],

        registerAccrual:
          request => {
            const result =
              createCounterpartyPayableMovement(
                {
                  movements:
                    get().movements
                },
                request
              );

            if (
              result.outcome ===
                "CREATED" ||
              result.outcome ===
                "REPLAY"
            ) {
              set({
                movements:
                  result.state.movements
              });

              queueResultMovement(
                result
              );
            }

            return result;
          },

        registerPayment:
          request => {
            const result =
              registerCounterpartyPayment(
                {
                  movements:
                    get().movements
                },
                request
              );

            if (
              result.outcome ===
                "CREATED" ||
              result.outcome ===
                "REPLAY"
            ) {
              set({
                movements:
                  result.state.movements
              });

              queueResultMovement(
                result
              );
            }

            return result;
          },

        reverseMovement:
          request => {
            const result =
              reverseCounterpartyPayableMovement(
                {
                  movements:
                    get().movements
                },
                request
              );

            if (
              result.outcome ===
                "CREATED" ||
              result.outcome ===
                "REPLAY"
            ) {
              set({
                movements:
                  result.state.movements
              });

              queueResultMovement(
                result
              );
            }

            return result;
          },

        getBalance: (
          scope,
          counterpartyCustomerId
        ) =>
          calculateCounterpartyPayableBalance(
            get().movements,
            scope,
            counterpartyCustomerId
          ),

        rehydrateFromServer:
          async scope => {
            const remote =
              await fetchCounterpartyPayableMovements(
                scope
              );

            const pendingIds =
              new Set(
                listCounterpartyPayableOutbox()
                  .filter(
                    record =>
                      record.status !==
                      "DONE"
                  )
                  .map(
                    record =>
                      record.movement.id
                  )
              );

            const existing =
              get().movements;

            const otherScopes =
              existing.filter(
                movement =>
                  movement.tenantId !==
                    scope.tenantId ||
                  movement.companyId !==
                    scope.companyId ||
                  movement.branchId !==
                    scope.branchId ||
                  movement.accountingPeriodId !==
                    scope.accountingPeriodId
              );

            const pendingLocal =
              existing.filter(
                movement =>
                  movement.tenantId ===
                    scope.tenantId &&
                  movement.companyId ===
                    scope.companyId &&
                  movement.branchId ===
                    scope.branchId &&
                  movement.accountingPeriodId ===
                    scope.accountingPeriodId &&
                  pendingIds.has(
                    movement.id
                  )
              );

            const remoteIds =
              new Set(
                remote.map(
                  movement =>
                    movement.id
                )
              );

            set({
              movements: [
                ...otherScopes,
                ...remote,
                ...pendingLocal.filter(
                  movement =>
                    !remoteIds.has(
                      movement.id
                    )
                )
              ]
            });
          }
      }),
      {
        name:
          "enverp-counterparty-payable-v1",
        partialize:
          state => ({
            movements:
              state.movements
          })
      }
    )
  );