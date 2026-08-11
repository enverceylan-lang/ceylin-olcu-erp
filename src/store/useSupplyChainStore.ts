import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ErpScope } from "@/lib/erpScope";
import {
  decideStockReservation,
  type ReservableStockLot,
  type StockReservation,
  type StockReservationRequest
} from "@/lib/stockReservationGuard";
import {
  decideSupplierOrder,
  decideSupplierReceipt,
  type SupplierOrder,
  type SupplierOrderRequest,
  type SupplierReceipt,
  type SupplierReceiptRequest
} from "@/lib/supplierSupplyFlow";
import {
  decideCreatePurchaseDocument
} from "@/lib/purchaseDocumentService";
import type {
  CreatePurchaseDocumentRequest,
  PurchaseDocument
} from "@/lib/purchaseContracts";
import type {
  StoreCutLot
} from "@/lib/storeCutPlanning";
import {
  validateTradeOrderLink,
  type TradeOrderLink
} from "@/lib/tradeOrderContracts";
import {
  decideStoreCutCompletion,
  type StoreCutCompletion,
  type StoreCutCompletionRequest
} from "@/lib/storeCutCompletion";
import {
  decideInventoryConsumption,
  decideInventoryConsumptionReversal,
  type InventoryConsumption,
  type InventoryConsumptionReversal
} from "@/lib/inventoryConsumption";

export interface SupplyStockLot
  extends ReservableStockLot {
  lotCode?: string;
  colorTone?: string;
  patternCode?: string;

  // STOCK V1 — immutable purchase-cost metadata for this physical lot.
  purchaseUnitCost?: number;
  supplierCustomerId?: string;
  purchaseDocumentId?: string;
  receivedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export type SupplyStoreResult<T> =
  | {
      outcome:
        | "CREATED"
        | "UPDATED"
        | "REPLAY";
      value: T;
    }
  | {
      outcome: "REJECTED";
      reason: string;
    };

interface SupplyChainState {
  lots: SupplyStockLot[];
  reservations: StockReservation[];
  supplierOrders: SupplierOrder[];
  supplierReceipts: SupplierReceipt[];
  purchaseDocuments: PurchaseDocument[];
  tradeOrderLinks: TradeOrderLink[];
  cutCompletions: StoreCutCompletion[];
  inventoryConsumptions: InventoryConsumption[];
  inventoryConsumptionReversals:
    InventoryConsumptionReversal[];

  upsertLot(
    lot: SupplyStockLot
  ): SupplyStoreResult<SupplyStockLot>;

  reserveStock(
    request: StockReservationRequest
  ): SupplyStoreResult<StockReservation>;

  createSupplierOrder(
    request: SupplierOrderRequest
  ): SupplyStoreResult<SupplierOrder>;

  receiveSupplierMaterial(
    request: SupplierReceiptRequest
  ): SupplyStoreResult<SupplierReceipt>;

  rollbackSupplierReceiptCreated(
    input: {
      scope: ErpScope;
      receiptId: string;
      supplierOrder: SupplierOrder;
    }
  ): void;

  createPurchaseDocument(
    request: CreatePurchaseDocumentRequest
  ): SupplyStoreResult<PurchaseDocument>;

  saveTradeOrderLink(
    link: TradeOrderLink
  ): SupplyStoreResult<TradeOrderLink>;

  getStoreCutLots(
    scope: ErpScope,
    stockItemId?: string
  ): StoreCutLot[];

  completeStoreCut(
    request: StoreCutCompletionRequest
  ): SupplyStoreResult<StoreCutCompletion>;

  rollbackStoreCutCompletionCreated(
    input: {
      scope: ErpScope;
      completionId: string;
      reservationId: string;
      lotId: string;
      previousOnHandMeters: number;
      reversedByUserId: string;
      reversedAt: string;
      reason: string;
      source: string;
    }
  ): SupplyStoreResult<InventoryConsumptionReversal>;

  rollbackFulfillmentCreated(
    input: {
      scope: ErpScope;
      reservationIds: string[];
      supplierOrderIds: string[];
    }
  ): void;
}

function sameScope(
  left: ErpScope,
  right: ErpScope
): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.companyId === right.companyId &&
    left.branchId === right.branchId &&
    left.accountingPeriodId ===
      right.accountingPeriodId
  );
}

function roundMeters(
  value: number
): number {
  return Math.round(value * 1_000_000) /
    1_000_000;
}

function activeReservedMeters(
  lotId: string,
  reservations: StockReservation[]
): number {
  return roundMeters(
    reservations
      .filter(
        reservation =>
          reservation.stockLotId === lotId &&
          reservation.status === "ACTIVE"
      )
      .reduce(
        (total, reservation) =>
          total +
          reservation.quantityMeters,
        0
      )
  );
}

function validateLot(
  lot: SupplyStockLot
): string | null {
  const textValues = [
    lot.id,
    lot.stockItemId,
    lot.tenantId,
    lot.companyId,
    lot.branchId,
    lot.accountingPeriodId,
    lot.createdAt,
    lot.updatedAt
  ];

  if (
    textValues.some(
      value => !value?.trim()
    )
  ) {
    return "LOT_REQUIRED_FIELD_MISSING";
  }

  if (
    !Number.isFinite(lot.onHandMeters) ||
    lot.onHandMeters < 0 ||
    !Number.isFinite(lot.unusableMeters) ||
    lot.unusableMeters < 0 ||
    lot.unusableMeters >
      lot.onHandMeters
  ) {
    return "LOT_QUANTITY_INVALID";
  }

  return null;
}

export const useSupplyChainStore =
  create<SupplyChainState>()(
    persist(
      (set, get) => ({
        lots: [],
        reservations: [],
        supplierOrders: [],
        supplierReceipts: [],
        purchaseDocuments: [],
        tradeOrderLinks: [],
        cutCompletions: [],
        inventoryConsumptions: [],
        inventoryConsumptionReversals: [],

        upsertLot: lot => {
          const validation =
            validateLot(lot);

          if (validation) {
            return {
              outcome: "REJECTED",
              reason: validation
            };
          }

          const existing =
            get().lots.find(
              current =>
                current.id === lot.id &&
                sameScope(current, lot)
            );

          if (existing) {
            set({
              lots:
                get().lots.map(
                  current =>
                    current.id === lot.id &&
                    sameScope(current, lot)
                      ? lot
                      : current
                )
            });

            return {
              outcome: "UPDATED",
              value: lot
            };
          }

          set({
            lots: [
              ...get().lots,
              lot
            ]
          });

          return {
            outcome: "CREATED",
            value: lot
          };
        },

        reserveStock: request => {
          const lot =
            get().lots.find(
              current =>
                current.id ===
                  request.stockLotId &&
                sameScope(current, request)
            );

          const decision =
            decideStockReservation(
              request,
              get().reservations,
              lot
            );

          if (
            decision.outcome === "REJECT"
          ) {
            return {
              outcome: "REJECTED",
              reason: decision.reason
            };
          }

          if (
            decision.outcome === "REPLAY"
          ) {
            return {
              outcome: "REPLAY",
              value:
                decision.reservation
            };
          }

          set({
            reservations: [
              ...get().reservations,
              decision.reservation
            ]
          });

          return {
            outcome: "CREATED",
            value:
              decision.reservation
          };
        },

        createSupplierOrder:
          request => {
            const decision =
              decideSupplierOrder(
                request,
                get().supplierOrders
              );

            if (
              decision.outcome ===
              "REJECT"
            ) {
              return {
                outcome: "REJECTED",
                reason: decision.reason
              };
            }

            if (
              decision.outcome ===
              "REPLAY"
            ) {
              return {
                outcome: "REPLAY",
                value: decision.order
              };
            }

            set({
              supplierOrders: [
                ...get().supplierOrders,
                decision.order
              ]
            });

            return {
              outcome: "CREATED",
              value: decision.order
            };
          },

        receiveSupplierMaterial:
          request => {
            const order =
              get().supplierOrders.find(
                current =>
                  current.id ===
                    request
                      .supplierOrderId &&
                  sameScope(
                    current,
                    request
                  )
              );

            const decision =
              decideSupplierReceipt(
                request,
                get().supplierReceipts,
                order
              );

            if (
              decision.outcome ===
              "REJECT"
            ) {
              return {
                outcome: "REJECTED",
                reason: decision.reason
              };
            }

            if (
              decision.outcome ===
              "REPLAY"
            ) {
              return {
                outcome: "REPLAY",
                value: decision.receipt
              };
            }

            set({
              supplierOrders:
                get().supplierOrders.map(
                  current =>
                    current.id ===
                      decision.order.id &&
                    sameScope(
                      current,
                      request
                    )
                      ? decision.order
                      : current
                ),
              supplierReceipts: [
                ...get().supplierReceipts,
                decision.receipt
              ]
            });

            return {
              outcome: "CREATED",
              value: decision.receipt
            };
          },

        rollbackSupplierReceiptCreated:
          input => {
            set({
              supplierOrders:
                get().supplierOrders.map(
                  current =>
                    current.id ===
                      input.supplierOrder.id &&
                    sameScope(
                      current,
                      input.scope
                    )
                      ? input.supplierOrder
                      : current
                ),
              supplierReceipts:
                get().supplierReceipts.filter(
                  receipt =>
                    !(
                      receipt.id ===
                        input.receiptId &&
                      sameScope(
                        receipt,
                        input.scope
                      )
                    )
                )
            });
          },

        createPurchaseDocument:
          request => {
            const decision =
              decideCreatePurchaseDocument(
                request,
                get().purchaseDocuments
              );

            if (
              decision.outcome ===
              "REJECTED"
            ) {
              return {
                outcome: "REJECTED",
                reason:
                  decision.reason
              };
            }

            if (
              decision.outcome ===
              "REPLAY"
            ) {
              return {
                outcome: "REPLAY",
                value:
                  decision.document
              };
            }

            set({
              purchaseDocuments: [
                ...get().purchaseDocuments,
                decision.document
              ]
            });

            return {
              outcome: "CREATED",
              value:
                decision.document
            };
          },

        saveTradeOrderLink: link => {
          const errors =
            validateTradeOrderLink(
              link
            );

          if (errors.length > 0) {
            return {
              outcome: "REJECTED",
              reason:
                errors.join(" | ")
            };
          }

          const sameIdempotency =
            get().tradeOrderLinks.find(
              current =>
                current.idempotencyKey ===
                  link.idempotencyKey &&
                sameScope(current, link)
            );

          if (sameIdempotency) {
            if (
              JSON.stringify(
                sameIdempotency
              ) === JSON.stringify(link)
            ) {
              return {
                outcome: "REPLAY",
                value:
                  sameIdempotency
              };
            }

            return {
              outcome: "REJECTED",
              reason:
                "IDEMPOTENCY_CONFLICT"
            };
          }

          const existing =
            get().tradeOrderLinks.find(
              current =>
                current.id === link.id &&
                sameScope(current, link)
            );

          if (existing) {
            set({
              tradeOrderLinks:
                get()
                  .tradeOrderLinks
                  .map(
                    current =>
                      current.id ===
                        link.id &&
                      sameScope(
                        current,
                        link
                      )
                        ? link
                        : current
                  )
            });

            return {
              outcome: "UPDATED",
              value: link
            };
          }

          set({
            tradeOrderLinks: [
              ...get().tradeOrderLinks,
              link
            ]
          });

          return {
            outcome: "CREATED",
            value: link
          };
        },

        completeStoreCut:
          request => {
            const reservation =
              get().reservations.find(
                current =>
                  current.id ===
                    request.reservationId &&
                  sameScope(
                    current,
                    request
                  )
              );

            if (!reservation) {
              return {
                outcome: "REJECTED",
                reason:
                  "RESERVATION_NOT_FOUND"
              };
            }

            const lot =
              get().lots.find(
                current =>
                  current.id ===
                    request.stockLotId &&
                  sameScope(
                    current,
                    request
                  )
              );

            if (!lot) {
              return {
                outcome: "REJECTED",
                reason: "LOT_NOT_FOUND"
              };
            }

            const matchesReservation =
              reservation.saleId ===
                request.saleId &&
              reservation.saleItemId ===
                request.saleItemId &&
              reservation.productionOrderId ===
                request.productionOrderId &&
              reservation.stockItemId ===
                request.stockItemId &&
              reservation.stockLotId ===
                request.stockLotId &&
              Math.abs(
                reservation.quantityMeters -
                  request.reservedMeters
              ) <= 0.000001;

            if (!matchesReservation) {
              return {
                outcome: "REJECTED",
                reason:
                  "RESERVATION_MISMATCH"
              };
            }

            if (
              request.consumptionMode ===
                "USE_WHOLE_LOT"
            ) {
              const otherActiveReservedMeters =
                activeReservedMeters(
                  lot.id,
                  get().reservations.filter(
                    current =>
                      current.id !==
                        reservation.id &&
                      sameScope(
                        current,
                        request
                      )
                  )
                );

              if (
                otherActiveReservedMeters >
                0.000001
              ) {
                return {
                  outcome: "REJECTED",
                  reason:
                    "WHOLE_LOT_HAS_OTHER_ACTIVE_RESERVATIONS"
                };
              }
            }

            const decision =
              decideStoreCutCompletion(
                request,
                get().cutCompletions,
                lot
              );

            if (
              decision.outcome ===
              "REJECT"
            ) {
              return {
                outcome: "REJECTED",
                reason: decision.reason
              };
            }

            if (
              decision.outcome ===
              "REPLAY"
            ) {
              return {
                outcome: "REPLAY",
                value:
                  decision.completion
              };
            }

            if (
              reservation.status !==
              "ACTIVE"
            ) {
              return {
                outcome: "REJECTED",
                reason:
                  "RESERVATION_NOT_ACTIVE"
              };
            }

            const completion =
              decision.completion;


            const consumptionDecision =
              decideInventoryConsumption(
                completion,
                get().inventoryConsumptions
              );

            if (
              consumptionDecision.outcome ===
              "REJECT"
            ) {
              return {
                outcome: "REJECTED",
                reason:
                  consumptionDecision.reason
              };
            }

            const inventoryConsumption =
              consumptionDecision.consumption;
set({
              lots:
                get().lots.map(
                  current =>
                    current.id ===
                      lot.id &&
                    sameScope(
                      current,
                      request
                    )
                      ? {
                          ...current,
                          onHandMeters:
                            completion
                              .lotRemainingMeters,
                          updatedAt:
                            completion
                              .completedAt
                        }
                      : current
                ),
              reservations:
                get().reservations.map(
                  current =>
                    current.id ===
                      reservation.id &&
                    sameScope(
                      current,
                      request
                    )
                      ? {
                          ...current,
                          status:
                            "CONSUMED"
                        }
                      : current
                ),
              cutCompletions: [
                ...get().cutCompletions,
                completion
              ],
              inventoryConsumptions:
                consumptionDecision.outcome ===
                  "CREATE"
                  ? [
                      ...get()
                        .inventoryConsumptions,
                      inventoryConsumption
                    ]
                  : get()
                      .inventoryConsumptions
            });

            return {
              outcome: "CREATED",
              value: completion
            };
          },

        rollbackStoreCutCompletionCreated:
          input => {
            const originalConsumption =
              get().inventoryConsumptions.find(
                consumption =>
                  consumption.cutCompletionId ===
                    input.completionId &&
                  sameScope(
                    consumption,
                    input.scope
                  )
              );

            if (!originalConsumption) {
              return {
                outcome: "REJECTED",
                reason:
                  "INVENTORY_CONSUMPTION_NOT_FOUND"
              };
            }

            const reversalDecision =
              decideInventoryConsumptionReversal(
                {
                  original:
                    originalConsumption,
                  scope: input.scope,
                  actorUserId:
                    input.reversedByUserId,
                  occurredAt:
                    input.reversedAt,
                  reason: input.reason,
                  source: input.source
                },
                get()
                  .inventoryConsumptionReversals
              );

            if (
              reversalDecision.outcome ===
              "REJECT"
            ) {
              return {
                outcome: "REJECTED",
                reason:
                  reversalDecision.reason
              };
            }

            set({
              lots:
                get().lots.map(
                  current =>
                    current.id ===
                      input.lotId &&
                    sameScope(
                      current,
                      input.scope
                    )
                      ? {
                          ...current,
                          onHandMeters:
                            input
                              .previousOnHandMeters
                        }
                      : current
                ),
              reservations:
                get().reservations.map(
                  current =>
                    current.id ===
                      input.reservationId &&
                    sameScope(
                      current,
                      input.scope
                    ) &&
                    current.status ===
                      "CONSUMED"
                      ? {
                          ...current,
                          status: "ACTIVE"
                        }
                      : current
                ),
              cutCompletions:
                get().cutCompletions.filter(
                  completion =>
                    !(
                      completion.id ===
                        input.completionId &&
                      sameScope(
                        completion,
                        input.scope
                      )
                    )
                ),
              inventoryConsumptions:
                get().inventoryConsumptions,
              inventoryConsumptionReversals:
                reversalDecision.outcome ===
                  "CREATE"
                  ? [
                      ...get()
                        .inventoryConsumptionReversals,
                      reversalDecision.reversal
                    ]
                  : get()
                      .inventoryConsumptionReversals
            });
            return {
              outcome:
                reversalDecision.outcome ===
                  "CREATE"
                  ? "CREATED"
                  : "REPLAY",
              value:
                reversalDecision.reversal
            };

          },

        rollbackFulfillmentCreated:
          input => {
            const reservationIds =
              new Set(
                input.reservationIds
              );
            const supplierOrderIds =
              new Set(
                input.supplierOrderIds
              );

            set({
              reservations:
                get().reservations.filter(
                  reservation =>
                    !(
                      reservationIds.has(
                        reservation.id
                      ) &&
                      sameScope(
                        reservation,
                        input.scope
                      )
                    )
                ),
              supplierOrders:
                get().supplierOrders.filter(
                  order =>
                    !(
                      supplierOrderIds.has(
                        order.id
                      ) &&
                      sameScope(
                        order,
                        input.scope
                      )
                    )
                )
            });
          },

        getStoreCutLots:
          (
            scope,
            stockItemId
          ) => {
            const reservations =
              get().reservations;

            return get()
              .lots
              .filter(
                lot =>
                  sameScope(
                    lot,
                    scope
                  ) &&
                  (
                    !stockItemId ||
                    lot.stockItemId ===
                      stockItemId
                  )
              )
              .map(
                lot => ({
                  id: lot.id,
                  stockItemId:
                    lot.stockItemId,
                  onHandMeters:
                    lot.onHandMeters,
                  reservedMeters:
                    activeReservedMeters(
                      lot.id,
                      reservations
                    ),
                  unusableMeters:
                    lot.unusableMeters,
                  lotCode:
                    lot.lotCode,
                  colorTone:
                    lot.colorTone,
                  patternCode:
                    lot.patternCode,
                  isBlocked:
                    lot.isBlocked
                })
              );
          }
      }),
      {
        name:
          "enverp-supply-chain-v1",
        partialize: state => ({
          lots: state.lots,
          reservations:
            state.reservations,
          supplierOrders:
            state.supplierOrders,
          supplierReceipts:
            state.supplierReceipts,
          purchaseDocuments:
            state.purchaseDocuments,
          tradeOrderLinks:
            state.tradeOrderLinks,
          cutCompletions:
            state.cutCompletions,
          inventoryConsumptions:
            state.inventoryConsumptions,
          inventoryConsumptionReversals:
            state.inventoryConsumptionReversals
        })
      }
    )
  );
