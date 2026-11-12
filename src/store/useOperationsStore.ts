import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mergeMainOperationsW1 } from "@/lib/mainOperationW1";
import { erpScopeMatches, type ErpScope } from "@/lib/erpScope";
import { resolveInstallationWorkAddress } from "@/lib/customerAddressModel";
import { getSaleFulfillmentLines, isFulfillmentLineReady, hasCompletedSaleFulfillment, fulfillmentLineLabel } from "@/lib/installationFulfillment";
import { useSupplyChainStore } from "@/store/useSupplyChainStore";
import { buildAgendaEvent } from "@/lib/operationsWorkflow";
import { routeInstallationAfterTailorCompletion } from "@/lib/tailorCompletionInstallationCoordinator";
import { useSalesStore } from "@/store/salesStore";
import { useStore } from "@/store/useStore";
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

  mergeCentralMainOperations(scope: ErpScope, records: OperationRecord[]): string[];
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

function updateGeneralFulfillmentProgress(state: OperationsStateData, operation: OperationRecord): OperationsStateData {
  if (operation.kind !== "INSTALLATION" || !operation.fulfillmentLineId || operation.status !== "COMPLETED") return state;
  const parent = state.operations.find(item => item.kind === "GENERAL" && item.id === operation.parentOperationId &&
    item.saleId === operation.saleId && erpScopeMatches(item, operation));
  if (!parent || parent.status === "COMPLETED" || parent.status === "CANCELLED") return state;
  const sale = useSalesStore.getState().sales.find(item => item.id === parent.saleId && erpScopeMatches(item, parent));
  const completed = hasCompletedSaleFulfillment(sale, state.operations, parent);
  if (!completed && parent.status !== "DRAFT") return state;
  const progressed: OperationRecord = {
    ...parent, status: completed ? "COMPLETED" : "IN_PROGRESS", updatedAt: operation.updatedAt,
    ...(completed ? { completedAt: operation.completedAt, completedByUserId: operation.completedByUserId } : {}),
  };
  return {
    operations: state.operations.map(item => item === parent ? progressed : item),
    agendaEvents: [...state.agendaEvents.filter(event => event.operationId !== parent.id || !erpScopeMatches(event, parent)),
      buildAgendaEvent(progressed)],
  };
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

          if (input.kind === "INSTALLATION") {
            const sales = useSalesStore.getState().sales;
            const sale = sales.find(sale => sale.id === input.parent.saleId && erpScopeMatches(sale, input.parent));
            if (input.fulfillmentMode !== "STORE_PICKUP") {
              const address = resolveInstallationWorkAddress(input.parent, sale, useStore.getState().customers);
              if (!address) return { outcome: "REJECTED", state: current, reason: "INSTALLATION_ADDRESS_REQUIRED" };
              input = { ...input, parent: { ...input.parent, address } };
            }
            if (!sale || sale.customerId !== input.parent.customerId) {
              return { outcome: "REJECTED", state: current, reason: "FULFILLMENT_LINE_REQUIRED" };
            }
            const lines = getSaleFulfillmentLines(sale);
            const line = lines.find(item => item.id === input.fulfillmentLineId) ?? (!input.fulfillmentLineId && lines.length === 1 ? lines[0] : undefined);
            if (!line || lines.filter(item => item.id === line.id).length !== 1) {
              return { outcome: "REJECTED", state: current, reason: "FULFILLMENT_LINE_REQUIRED" };
            }
            const existing = current.operations.find(item => item.kind === "INSTALLATION" && item.saleId === sale.id &&
              item.parentOperationId === input.parent.id && item.fulfillmentLineId === line.id &&
              item.status !== "CANCELLED" && erpScopeMatches(item, sale));
            if (!existing && (input.parent.status === "COMPLETED" || input.parent.status === "CANCELLED")) {
              return { outcome: "REJECTED", state: current, reason: "STORE_PICKUP_NOT_READY" };
            }
            if (!existing && !isFulfillmentLineReady(sale, line, useStore.getState().productionItems,
                useSupplyChainStore.getState().supplierOrders, sales.filter(item => item.id === sale.id).length === 1)) {
              return { outcome: "REJECTED", state: current, reason: "STORE_PICKUP_NOT_READY" };
            }
            input = { ...input, fulfillmentLineId: line.id, fulfillmentLineLabel: fulfillmentLineLabel(line) };
          }
          const result = routeChildOperation(current, input);

          if (
            result.outcome ===
            "CREATED"
          ) {
            set(result.state);
          }

          return result;
        },

        mergeCentralMainOperations: (scope, records) => {
          const current = get();
          const { added, review } = mergeMainOperationsW1(current.operations, records, scope);
          if (added.length) {
            set({
              operations: [...current.operations, ...added],
              agendaEvents: [...current.agendaEvents, ...rebuildAgendaEvents(added)],
            });
          }
          return review;
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

          const operation = current.operations.find(item => item.id === operationId &&
            (!context?.scope || erpScopeMatches(item, context.scope)));
          if (operation && target === "COMPLETED") {
            const sale = useSalesStore.getState().sales.find(item => item.id === operation.saleId && erpScopeMatches(item, operation));
            if (operation.kind === "GENERAL" && !hasCompletedSaleFulfillment(sale, current.operations, operation)) {
              return { outcome: "REJECTED", state: current, reason: "FULFILLMENT_INCOMPLETE" };
            }
            if (operation.fulfillmentMode === "STORE_PICKUP" && context?.fulfillmentMethod === "ON_SITE") {
              const address = resolveInstallationWorkAddress(operation, sale, useStore.getState().customers);
              if (!address) return { outcome: "REJECTED", state: current, reason: "INSTALLATION_ADDRESS_REQUIRED" };
              context = { ...context, fulfillmentAddress: address };
            }
          }

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
            set(updateGeneralFulfillmentProgress(result.state, result.operation));
            if (result.operation.kind === "TAILOR" && result.operation.status === "COMPLETED") {
              routeInstallationAfterTailorCompletion({ operation: result.operation, actorUserId: actor.userId, now: occurredAt });
            }
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
              ...updateGeneralFulfillmentProgress(result.state, result.operation),

              providerStatusAudits: [
                ...state.providerStatusAudits,
                result.audit
              ],

              providerEarningsPendingDrafts:
                nextPendingDrafts
            }));

            if (result.operation.kind === "TAILOR" && result.operation.status === "COMPLETED") {
              routeInstallationAfterTailorCompletion({
                operation: result.operation, actorUserId: request.actor.userId, now: request.occurredAt,
              });
            }
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
