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
import type { OperationTransitionContext } from "@/lib/operationsWorkflow";
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
  createEstimatedEarningFromCompletedOperation,
  type ProviderCompletionEarningsBridgeResult
} from "@/lib/providerCompletionEarningsBridge";
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
  type ProviderEarningsLedgerState,
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
import {
  projectProviderEarningSourceTruth
} from "@/lib/finance/counterpartySourceTruthProducerBridge";
import {
  enqueueCounterpartySourceTruthPersistence
} from "@/lib/finance/counterpartySourceTruthOutbox";
import {
  useCounterpartyPayableStore
} from "@/store/useCounterpartyPayableStore";

type AutomaticProviderEarningResult =
  | ProviderEarningsLedgerResult
  | Extract<
      ProviderCompletionEarningsBridgeResult,
      {
        outcome:
          "REJECTED" |
          "NOT_FOUND";
      }
    >
  | {
      outcome:
        "REJECTED";
      state:
        ProviderEarningsLedgerState;
      reason:
        "INVALID_REQUEST";
    };

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

  registerAutomaticProviderEarning(
    request: {
      operation:
        OperationRecord;
      amount:
        number;
      occurredAt:
        string;
      actorUserId:
        string;
    }
  ): AutomaticProviderEarningResult;

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
    occurredAt: string,
    context?: OperationTransitionContext
  ): UpdateOperationStatusResult;

  updateProviderStatus(
    request:
      ProviderOperationStatusCommandRequest
  ,
    context?: OperationTransitionContext
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
          occurredAt,
          context
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
              occurredAt,
              context
            );

          if (result.outcome === "UPDATED") {
            set(result.state);
          }

          return result;
        },
        updateProviderStatus:
          (request, context) => {
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
                request,
                context
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
                "REPORT_COMPLETED" &&
              typeof request
                .automaticEarningsAmount !==
                "number"
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

        registerAutomaticProviderEarning:
          request => {
            const providerCustomerId =
              String(
                request.operation.party
                  ?.providerCustomerId ||
                ""
              ).trim();

            if (
              request.operation.kind !==
                "INSTALLATION" ||
              request.operation.status !==
                "COMPLETED" ||
              request.operation.party
                ?.assignmentType !==
                "EXTERNAL" ||
              !providerCustomerId
            ) {
              return {
                outcome:
                  "REJECTED",
                state: {
                  entries:
                    get()
                      .providerEarningsEntries,
                  paymentSnapshots:
                    get()
                      .providerPaymentSnapshots
                },
                reason:
                  "INVALID_REQUEST"
              };
            }

            const created =
              createEstimatedEarningFromCompletedOperation({
                state: {
                  entries:
                    get()
                      .providerEarningsEntries,
                  paymentSnapshots:
                    get()
                      .providerPaymentSnapshots
                },
                operation:
                  request.operation,
                earningsEntryId:
                  `provider-earning:${request.operation.id}`,
                currency:
                  "TRY",
                estimatedAmount:
                  request.amount
              });

            if (
              created.outcome ===
                "REJECTED" ||
              created.outcome ===
                "NOT_FOUND"
            ) {
              return created;
            }

            const createdState =
              created.state;

            const entry =
              created.entry;

            const finalized =
              finalizeProviderEarning(
                createdState,
                {
                  tenantId:
                    request.operation
                      .tenantId,
                  companyId:
                    request.operation
                      .companyId,
                  branchId:
                    request.operation
                      .branchId,
                  accountingPeriodId:
                    request.operation
                      .accountingPeriodId,
                  entryId:
                    entry.id,
                  providerCustomerId,
                  finalizedAmount:
                    request.amount,
                  finalizedAt:
                    request.occurredAt,
                  finalizedByUserId:
                    request.actorUserId
                }
              );

            if (
              finalized.outcome ===
                "UPDATED" ||
              finalized.outcome ===
                "REPLAY"
            ) {
              set({
                providerEarningsEntries:
                  finalized.state.entries,
                providerPaymentSnapshots:
                  finalized.state
                    .paymentSnapshots
              });

              const providerSourceTruth =
                projectProviderEarningSourceTruth({
                  tenantId:
                    request.operation
                      .tenantId,
                  companyId:
                    request.operation
                      .companyId,
                  branchId:
                    request.operation
                      .branchId,
                  accountingPeriodId:
                    request.operation
                      .accountingPeriodId,
                  providerCustomerId,
                  providerType:
                    entry.providerType,
                  assignmentType:
                    "EXTERNAL",
                  operationId:
                    request.operation.id,
                  earningsEntryId:
                    entry.id,
                  sourceDocumentId:
                    entry.sourceDocumentId,
                  finalizedAmount:
                    request.amount,
                  currency:
                    "TRY",
                  occurredAt:
                    request.occurredAt,
                  finalizedAt:
                    request.occurredAt,
                  recordedAt:
                    request.occurredAt
                });

              if (!providerSourceTruth.ok) {
                return {
                  outcome:
                    "REJECTED",
                  state:
                    finalized.state,
                  reason:
                    "INVALID_REQUEST"
                };
              }

              enqueueCounterpartySourceTruthPersistence({
                kind:
                  "PROVIDER_EARNING",
                source:
                  providerSourceTruth.value
              });

              const counterpartyType =
                entry.providerType;

              const payableResult =
                useCounterpartyPayableStore
                  .getState()
                  .registerAccrual({
                    tenantId:
                      request.operation
                        .tenantId,
                    companyId:
                      request.operation
                        .companyId,
                    branchId:
                      request.operation
                        .branchId,
                    accountingPeriodId:
                      request.operation
                        .accountingPeriodId,
                    id:
                      `counterparty-payable:${entry.id}`,
                    idempotencyKey:
                      `COUNTERPARTY_PAYABLE:${entry.id}`,
                    counterpartyCustomerId:
                      providerCustomerId,
                    counterpartyType,
                    kind:
                      "ACCRUAL",
                    amount:
                      request.amount,
                    currency:
                      "TRY",
                    occurredAt:
                      request.occurredAt,
                    recordedAt:
                      request.occurredAt,
                    sourceDocumentId:
                      entry.sourceDocumentId,
                    operationId:
                      request.operation.id,
                    providerEarningsEntryId:
                      entry.id,
                    note:
                      "Tamamlanan dış hizmet hakedişi"
                  });

              if (
                payableResult.outcome ===
                  "REJECTED"
              ) {
                return {
                  outcome:
                    "REJECTED",
                  state:
                    finalized.state,
                  reason:
                    "INVALID_REQUEST"
                };
              }
            }

            return finalized;
          },

        registerProviderPaymentSnapshot:
          request => {
            if (
              request.currency !==
              "TRY"
            ) {
              return {
                outcome:
                  "REJECTED",
                state: {
                  entries:
                    get()
                      .providerEarningsEntries,
                  paymentSnapshots:
                    get()
                      .providerPaymentSnapshots
                },
                reason:
                  "CURRENCY_MISMATCH"
              };
            }

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

              const earning =
                result.entry;

              const payablePayment =
                useCounterpartyPayableStore
                  .getState()
                  .registerPayment({
                    tenantId:
                      request.tenantId,
                    companyId:
                      request.companyId,
                    branchId:
                      request.branchId,
                    accountingPeriodId:
                      request.accountingPeriodId,
                    id:
                      `counterparty-payment:${request.sourcePaymentId}`,
                    idempotencyKey:
                      `COUNTERPARTY_PAYMENT:${request.sourcePaymentId}`,
                    counterpartyCustomerId:
                      request.providerCustomerId,
                    counterpartyType:
                      request.providerType,
                    amount:
                      request.amount,
                    currency:
                      request.currency,
                    occurredAt:
                      request.paidAt,
                    recordedAt:
                      request.recordedAt,
                    sourceDocumentId:
                      earning.sourceDocumentId,
                    operationId:
                      earning.operationId,
                    providerEarningsEntryId:
                      earning.id,
                    sourcePaymentId:
                      request.sourcePaymentId,
                    note:
                      "Provider hakediş ödemesi"
                  });

              if (
                payablePayment.outcome ===
                  "REJECTED"
              ) {
                return {
                  outcome:
                    "REJECTED",
                  state:
                    result.state,
                  reason:
                    "PAYMENT_SOURCE_CONFLICT"
                };
              }
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
