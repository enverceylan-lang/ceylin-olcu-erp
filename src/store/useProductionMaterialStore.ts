import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  validateProductionSourcePlan,
  type ProductionSourcePlan
} from "@/lib/productionSourceModel";
import {
  applyProductionMaterialReadiness
} from "@/lib/productionMaterialReadinessGate";
import {
  useStore
} from "@/store/useStore";

export type SaveProductionSourcePlanResult =
  | {
      outcome:
        | "CREATED"
        | "UPDATED"
        | "REPLAY";
      plan: ProductionSourcePlan;
      productionStatus: string;
      releasedForCutting: boolean;
    }
  | {
      outcome: "REJECTED";
      reason:
        | "INVALID_PLAN"
        | "PRODUCTION_ITEM_NOT_FOUND"
        | "PRODUCTION_ITEM_MISMATCH"
        | "STALE_VERSION"
        | "VERSION_CONFLICT";
      errors: string[];
    };

export type SaveProductionSourcePlansResult =
  | {
      outcome: "COMMITTED";
      results: SaveProductionSourcePlanResult[];
    }
  | {
      outcome: "REJECTED";
      reason: string;
      errors: string[];
    };

interface ProductionMaterialState {
  plans: ProductionSourcePlan[];

  savePlan(
    plan: ProductionSourcePlan
  ): SaveProductionSourcePlanResult;

  savePlansAtomically(
    plans: ProductionSourcePlan[]
  ): SaveProductionSourcePlansResult;

  getPlan(
    productionItemId: string
  ): ProductionSourcePlan | undefined;

  refreshProductionItem(
    productionItemId: string
  ): SaveProductionSourcePlanResult;
}

function samePlan(
  left: ProductionSourcePlan,
  right: ProductionSourcePlan
): boolean {
  return (
    JSON.stringify(left) ===
    JSON.stringify(right)
  );
}

function applyPlanToProductionItem(
  plan: ProductionSourcePlan
): {
  productionStatus: string;
  releasedForCutting: boolean;
} | null {
  const productionStore =
    useStore.getState();

  const item =
    productionStore.productionItems.find(
      current =>
        current.id ===
        plan.productionItemId
    );

  if (!item) {
    return null;
  }

  const gate =
    applyProductionMaterialReadiness(
      item,
      plan
    );

  if (
    gate.item.productionStatus !==
    item.productionStatus
  ) {
    productionStore.updateProductionItem(
      item.id,
      {
        productionStatus:
          gate.item.productionStatus
      }
    );
  }

  return {
    productionStatus:
      gate.item.productionStatus,
    releasedForCutting:
      gate.releasedForCutting
  };
}

export const useProductionMaterialStore =
  create<ProductionMaterialState>()(
    persist(
      (set, get) => ({
        plans: [],

        getPlan:
          productionItemId =>
            get().plans.find(
              plan =>
                plan.productionItemId ===
                productionItemId
            ),

        savePlan: plan => {
          const errors =
            validateProductionSourcePlan(
              plan
            );

          if (errors.length > 0) {
            return {
              outcome: "REJECTED",
              reason: "INVALID_PLAN",
              errors
            };
          }

          const productionItem =
            useStore
              .getState()
              .productionItems
              .find(
                item =>
                  item.id ===
                  plan.productionItemId
              );

          if (!productionItem) {
            return {
              outcome: "REJECTED",
              reason:
                "PRODUCTION_ITEM_NOT_FOUND",
              errors: [
                "Kaynak planının bağlı olduğu üretim kalemi bulunamadı."
              ]
            };
          }

          if (
            productionItem.id !==
            plan.productionItemId
          ) {
            return {
              outcome: "REJECTED",
              reason:
                "PRODUCTION_ITEM_MISMATCH",
              errors: [
                "Kaynak planı ile üretim kalemi eşleşmiyor."
              ]
            };
          }

          const existing =
            get().plans.find(
              current =>
                current.id === plan.id
            );

          if (
            existing &&
            plan.version <
              existing.version
          ) {
            return {
              outcome: "REJECTED",
              reason: "STALE_VERSION",
              errors: [
                "Eski kaynak planı sürümü yeni sürümün üzerine yazılamaz."
              ]
            };
          }

          if (
            existing &&
            plan.version ===
              existing.version
          ) {
            if (
              samePlan(
                existing,
                plan
              )
            ) {
              const applied =
                applyPlanToProductionItem(
                  existing
                );

              if (!applied) {
                return {
                  outcome:
                    "REJECTED",
                  reason:
                    "PRODUCTION_ITEM_NOT_FOUND",
                  errors: [
                    "Kaynak planının bağlı olduğu üretim kalemi bulunamadı."
                  ]
                };
              }

              return {
                outcome: "REPLAY",
                plan: existing,
                ...applied
              };
            }

            return {
              outcome: "REJECTED",
              reason:
                "VERSION_CONFLICT",
              errors: [
                "Aynı kaynak planı sürümü farklı içerikle kaydedilemez."
              ]
            };
          }

          const nextPlans =
            existing
              ? get().plans.map(
                  current =>
                    current.id ===
                    plan.id
                      ? plan
                      : current
                )
              : [
                  ...get().plans,
                  plan
                ];

          set({
            plans: nextPlans
          });

          const applied =
            applyPlanToProductionItem(
              plan
            );

          if (!applied) {
            return {
              outcome: "REJECTED",
              reason:
                "PRODUCTION_ITEM_NOT_FOUND",
              errors: [
                "Kaynak planı kaydedildi ancak üretim kalemi bulunamadı."
              ]
            };
          }

          return {
            outcome:
              existing
                ? "UPDATED"
                : "CREATED",
            plan,
            ...applied
          };
        },

        savePlansAtomically:
          plans => {
            const targetPlanIds =
              new Set(
                plans.map(
                  plan => plan.id
                )
              );

            const targetProductionItemIds =
              new Set(
                plans.map(
                  plan =>
                    plan.productionItemId
                )
              );

            /*
             * Tam store snapshot geri yüklemesi YOK.
             * Yalnız bu batch'in dokunabileceği planlar ve
             * production statusları saklanır.
             */
            const previousPlans =
              get().plans.filter(
                plan =>
                  targetPlanIds.has(
                    plan.id
                  )
              );

            const previousStatuses =
              new Map(
                useStore
                  .getState()
                  .productionItems
                  .filter(
                    item =>
                      targetProductionItemIds.has(
                        item.id
                      )
                  )
                  .map(
                    item => [
                      item.id,
                      item.productionStatus
                    ] as const
                  )
              );

            const rollbackBatch = () => {
              const unrelatedCurrentPlans =
                get().plans.filter(
                  plan =>
                    !targetPlanIds.has(
                      plan.id
                    )
                );

              set({
                plans: [
                  ...unrelatedCurrentPlans,
                  ...previousPlans
                ]
              });

              const productionStore =
                useStore.getState();

              for (
                const [
                  productionItemId,
                  productionStatus
                ] of previousStatuses
              ) {
                const currentItem =
                  productionStore
                    .productionItems
                    .find(
                      item =>
                        item.id ===
                        productionItemId
                    );

                if (
                  currentItem &&
                  currentItem.productionStatus !==
                    productionStatus
                ) {
                  productionStore
                    .updateProductionItem(
                      productionItemId,
                      {
                        productionStatus
                      }
                    );
                }
              }
            };

            const results:
              SaveProductionSourcePlanResult[] =
                [];

            for (const plan of plans) {
              const result =
                get().savePlan(plan);

              if (
                result.outcome ===
                "REJECTED"
              ) {
                rollbackBatch();

                return {
                  outcome: "REJECTED",
                  reason: result.reason,
                  errors: result.errors
                };
              }

              results.push(result);
            }

            return {
              outcome: "COMMITTED",
              results
            };
          },

        refreshProductionItem:
          productionItemId => {
            const plan =
              get().plans.find(
                current =>
                  current.productionItemId ===
                  productionItemId
              );

            if (!plan) {
              return {
                outcome: "REJECTED",
                reason: "INVALID_PLAN",
                errors: [
                  "Üretim kalemi için kaynak planı bulunamadı."
                ]
              };
            }

            const applied =
              applyPlanToProductionItem(
                plan
              );

            if (!applied) {
              return {
                outcome: "REJECTED",
                reason:
                  "PRODUCTION_ITEM_NOT_FOUND",
                errors: [
                  "Kaynak planının bağlı olduğu üretim kalemi bulunamadı."
                ]
              };
            }

            return {
              outcome: "REPLAY",
              plan,
              ...applied
            };
          }
      }),
      {
        name:
          "enverp-production-material-v1",
        partialize: state => ({
          plans: state.plans
        })
      }
    )
  );