import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ErpScope } from "@/lib/erpScope";
import {
  listScopedAgendaEvents,
  listScopedOperations,
  listVisibleOperationsForUser,
  rebuildAgendaEvents,
  saveOperationRecord,
  updateOperationRecordStatus,
  type OperationActor,
  type OperationsStateData,
  type SaveOperationResult,
  type UpdateOperationStatusResult
} from "@/lib/operationsRepository";
import type {
  AgendaEvent,
  OperationRecord,
  OperationStatus
} from "@/lib/operationsWorkflow";
import {
  executeProviderOperationStatusCommand,
  type ProviderOperationStatusAudit,
  type ProviderOperationStatusCommandRequest,
  type ProviderOperationStatusCommandResult
} from "@/lib/providerOperationStatusCommandService";
import {
  createProviderEarningsPendingDraft,
  type ProviderEarningsPendingDraft
} from "@/lib/providerEarningsPendingDraftService";
import {
  convertProviderEarningsDraft,
  setProviderEarningsDraftAmount,
  type ConvertProviderEarningsDraftRequest,
  type ConvertProviderEarningsDraftResult,
  type SetProviderEarningsDraftAmountRequest,
  type SetProviderEarningsDraftAmountResult
} from "@/lib/providerEarningsDraftAdminService";
import {
  finalizeProviderEarning,
  registerProviderPaymentSnapshot,
  type FinalizeProviderEarningRequest,
  type ProviderEarningsLedgerResult,
  type ProviderPaymentSnapshot,
  type RegisterProviderPaymentSnapshotRequest
} from "@/lib/providerEarningsLedgerService";
import type {
  ProviderEarningsEntry
} from "@/lib/providerEarningsViewService";
import {
  routeChildOperation,
  type RouteChildOperationInput,
  type RouteChildOperationResult
} from "@/lib/operationRoutingService";
import {
  syncMainOperationFromSale,
  type BuildMainOperationInput,
  type SyncMainOperationResult
} from "@/lib/saleMainOperationService";

interface OperationsStore
  extends OperationsStateData {
  hydrated: boolean;

  providerStatusAudits:
    ProviderOperationStatusAudit[];

  providerEarningsPendingDrafts:
    ProviderEarningsPendingDraft[];

  providerEarningsEntries:
    ProviderEarningsEntry[];

  providerPaymentSnapshots:
    ProviderPaymentSnapshot[];

  setProviderEarningsDraftAmount(
    request:
      SetProviderEarningsDraftAmountRequest
  ): SetProviderEarningsDraftAmountResult;

  convertProviderEarningsDraft(
    request:
      ConvertProviderEarningsDraftRequest
  ): ConvertProviderEarningsDraftResult;

  finalizeProviderEarning(
    request:
      FinalizeProviderEarningRequest
  ): ProviderEarningsLedgerResult;

  registerProviderPaymentSnapshot(
    request:
      RegisterProviderPaymentSnapshotRequest
  ): ProviderEarningsLedgerResult;

  setHydrated(
    hydrated: boolean
  ): void;

  saveOperation(
    request: OperationRecord
  ): SaveOperationResult;

  routeChild(
    input: RouteChildOperationInput
  ): RouteChildOperationResult;

  syncMainOperation(
    input: BuildMainOperationInput
  ): SyncMainOperationResult;

  updateStatus(
    operationId: string,
    target: OperationStatus,
    actor: OperationActor,
    occurredAt: string
  ): UpdateOperationStatusResult;

  updateProviderStatus(
    request:
      ProviderOperationStatusCommandRequest
  ): ProviderOperationStatusCommandResult;

  getOperations(
    scope: ErpScope
  ): OperationRecord[];

  getAgenda(
    scope: ErpScope
  ): AgendaEvent[];

  getVisibleOperations(
    scope: ErpScope,
    actor: OperationActor
  ): OperationRecord[];

  repairAgenda(): void;
}

export const useOperationsStore =
  create<OperationsStore>()(
    persist(
      (set, get) => ({
        operations: [],
        agendaEvents: [],
        providerStatusAudits: [],
        providerEarningsPendingDrafts: [],
        providerEarningsEntries: [],
        providerPaymentSnapshots: [],
        hydrated: false,

        setHydrated: hydrated =>
          set({ hydrated }),

        saveOperation: request => {
          const current: OperationsStateData = {
            operations: get().operations,
            agendaEvents: get().agendaEvents
          };

          const result =
            saveOperationRecord(
              current,
              request
            );

          if (result.outcome === "CREATED") {
            set(result.state);
          }

          return result;
        },

        syncMainOperation: input => {
          const current: OperationsStateData = {
            operations: get().operations,
            agendaEvents: get().agendaEvents
          };

          const result =
            syncMainOperationFromSale(
              current,
              input
            );

          if (
            result.outcome === "CREATED" ||
            result.outcome === "UPDATED"
          ) {
            set(result.state);
          }

          return result;
        },

        routeChild: input => {
          const current: OperationsStateData = {
            operations: get().operations,
            agendaEvents: get().agendaEvents
          };

          const result =
            routeChildOperation(
              current,
              input
            );

          if (
            result.outcome ===
            "CREATED"
          ) {
            set(result.state);
          }

          return result;
        },

        updateStatus: (
          operationId,
          target,
          actor,
          occurredAt
        ) => {
          const current: OperationsStateData = {
            operations: get().operations,
            agendaEvents: get().agendaEvents
          };

          const result =
            updateOperationRecordStatus(
              current,
              operationId,
              target,
              actor,
              occurredAt
            );

          if (result.outcome === "UPDATED") {
            set(result.state);
          }

          return result;
        },
        updateProviderStatus:
          request => {
            const currentState = {
              operations:
                get().operations,

              agendaEvents:
                get().agendaEvents
            };

            if (
              request.action ===
                "REPORT_COMPLETED" &&
              !request.earningsCurrency
            ) {
              return {
                outcome: "REJECTED",
                state: currentState,
                reason:
                  "EARNINGS_CURRENCY_REQUIRED"
              };
            }

            const result =
              executeProviderOperationStatusCommand(
                currentState,
                request
              );

            if (
              result.outcome !==
              "UPDATED"
            ) {
              return result;
            }

            let nextPendingDrafts =
              get()
                .providerEarningsPendingDrafts;

            if (
              request.action ===
              "REPORT_COMPLETED"
            ) {
              const draftResult =
                createProviderEarningsPendingDraft({
                  state: {
                    drafts:
                      nextPendingDrafts
                  },

                  operation:
                    result.operation,

                  draftId:
                    [
                      "provider-earning-draft",
                      result.operation.id
                    ].join(":"),

                  currency:
                    request.earningsCurrency as
                      NonNullable<
                        typeof request.earningsCurrency
                      >,

                  occurredAt:
                    request.occurredAt
                });

              if (
                draftResult.outcome ===
                "REJECTED"
              ) {
                return {
                  outcome: "REJECTED",
                  state: currentState,
                  reason:
                    [
                      "EARNINGS_DRAFT",
                      draftResult.reason
                    ].join(":")
                };
              }

              nextPendingDrafts =
                draftResult.state.drafts;
            }

            set(state => ({
              ...result.state,

              providerStatusAudits: [
                ...state.providerStatusAudits,
                result.audit
              ],

              providerEarningsPendingDrafts:
                nextPendingDrafts
            }));

            return result;
          },

        setProviderEarningsDraftAmount:
          request => {
            const result =
              setProviderEarningsDraftAmount(
                {
                  drafts:
                    get()
                      .providerEarningsPendingDrafts
                },
                request
              );

            if (
              result.outcome ===
              "UPDATED"
            ) {
              set({
                providerEarningsPendingDrafts:
                  result.state.drafts
              });
            }

            return result;
          },

        convertProviderEarningsDraft:
          request => {
            const result =
              convertProviderEarningsDraft(
                {
                  drafts:
                    get()
                      .providerEarningsPendingDrafts
                },
                {
                  entries:
                    get()
                      .providerEarningsEntries,

                  paymentSnapshots:
                    get()
                      .providerPaymentSnapshots
                },
                request
              );

            if (
              result.outcome ===
                "CONVERTED" ||
              result.outcome ===
                "REPLAY"
            ) {
              set({
                providerEarningsPendingDrafts:
                  result.draftState.drafts,

                providerEarningsEntries:
                  result.ledgerState.entries,

                providerPaymentSnapshots:
                  result.ledgerState
                    .paymentSnapshots
              });
            }

            return result;
          },
        finalizeProviderEarning:
          request => {
            const result =
              finalizeProviderEarning(
                {
                  entries:
                    get()
                      .providerEarningsEntries,

                  paymentSnapshots:
                    get()
                      .providerPaymentSnapshots
                },
                request
              );

            if (
              result.outcome ===
                "UPDATED" ||
              result.outcome ===
                "REPLAY"
            ) {
              set({
                providerEarningsEntries:
                  result.state.entries,

                providerPaymentSnapshots:
                  result.state
                    .paymentSnapshots
              });
            }

            return result;
          },

        registerProviderPaymentSnapshot:
          request => {
            const result =
              registerProviderPaymentSnapshot(
                {
                  entries:
                    get()
                      .providerEarningsEntries,

                  paymentSnapshots:
                    get()
                      .providerPaymentSnapshots
                },
                request
              );

            if (
              result.outcome ===
                "UPDATED" ||
              result.outcome ===
                "REPLAY"
            ) {
              set({
                providerEarningsEntries:
                  result.state.entries,

                providerPaymentSnapshots:
                  result.state
                    .paymentSnapshots
              });
            }

            return result;
          },
        getOperations: scope =>
          listScopedOperations(
            {
              operations: get().operations,
              agendaEvents: get().agendaEvents
            },
            scope
          ),

        getAgenda: scope =>
          listScopedAgendaEvents(
            {
              operations: get().operations,
              agendaEvents: get().agendaEvents
            },
            scope
          ),

        getVisibleOperations: (
          scope,
          actor
        ) =>
          listVisibleOperationsForUser(
            {
              operations: get().operations,
              agendaEvents: get().agendaEvents
            },
            scope,
            actor
          ),

        repairAgenda: () =>
          set(state => ({
            agendaEvents:
              rebuildAgendaEvents(
                state.operations
              )
          }))
      }),
      {
        name: "enverp-operations-v1",

        partialize: state => ({
          operations:
            state.operations,

          agendaEvents:
            state.agendaEvents,

          providerStatusAudits:
            state.providerStatusAudits,

          providerEarningsPendingDrafts:
            state.providerEarningsPendingDrafts,

          providerEarningsEntries:
            state.providerEarningsEntries,

          providerPaymentSnapshots:
            state.providerPaymentSnapshots
        }),

        onRehydrateStorage: () =>
          state => {
            state?.setHydrated(true);
          }
      }
    )
  );