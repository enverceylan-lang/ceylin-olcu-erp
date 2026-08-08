import {
  decideOperationRelease,
  type OperationDependencySignal,
  type OperationReleaseDecision
} from "./operationDependencyReleasePolicy";
import {
  type OperationRecord,
  type OperationTransitionContext
} from "./operationsWorkflow";
import {
  getProductionSourceReadiness
} from "./productionReadiness";
import type {
  ProductionSourcePlan
} from "./productionSourceModel";

export interface OperationReleaseProductionItem {
  id: string;
  orderId: string;
  saleLineId: string;
}

export interface OperationReleaseProjection {
  context?: OperationTransitionContext;
  decision?: OperationReleaseDecision;
  label: "SERBEST" | "BEKLIYOR" | "BLOKELI";
  nextAction: string;
}

function materialDependency(
  productionItem: OperationReleaseProductionItem,
  plan: ProductionSourcePlan | undefined
): OperationDependencySignal {
  if (!plan) {
    return {
      id: `material:${productionItem.id}`,
      label: "Malzeme kaynağı",
      required: true,
      state: "WAITING",
      reason: "Üretim kalemi için kaynak planı henüz oluşmadı.",
      sourceRef: productionItem.id
    };
  }

  const readiness = getProductionSourceReadiness(plan);

  if (readiness.status === "READY") {
    return {
      id: `material:${productionItem.id}`,
      label: "Malzeme kaynağı",
      required: true,
      state: "SATISFIED",
      sourceRef: plan.id
    };
  }

  if (readiness.status === "INVALID") {
    return {
      id: `material:${productionItem.id}`,
      label: "Malzeme kaynağı",
      required: true,
      state: "BLOCKED",
      reason: "Malzeme kaynak planı geçersiz veya çelişkili.",
      sourceRef: plan.id
    };
  }

  return {
    id: `material:${productionItem.id}`,
    label: "Malzeme kaynağı",
    required: true,
    state: "WAITING",
    reason:
      readiness.status === "PARTIALLY_READY"
        ? "Malzeme kısmen hazır; eksik kaynakların tamamlanması gerekiyor."
        : "Malzeme henüz hazır değil.",
    sourceRef: plan.id
  };
}

export function resolveOperationReleaseProjection(input: {
  operation: OperationRecord;
  productionItems: readonly OperationReleaseProductionItem[];
  sourcePlans: readonly ProductionSourcePlan[];
}): OperationReleaseProjection {
  // A1 material release is a production-start dependency.
  // Other operation kinds keep their existing transition contract until
  // their own explicit dependencies are introduced by later packages.
  if (input.operation.kind !== "TAILOR") {
    return {
      label: "SERBEST",
      nextAction: "Bu iş için A1 malzeme bağımlılığı gerekmiyor."
    };
  }

  const productionItems = input.productionItems.filter(
    item => item.orderId === input.operation.saleId
  );

  const dependencies: OperationDependencySignal[] =
    productionItems.length === 0
      ? [
          {
            id: `material:sale:${input.operation.saleId}`,
            label: "Üretim kalemi",
            required: true,
            state: "WAITING",
            reason: "Satışa bağlı üretim kalemi henüz oluşmadı.",
            sourceRef: input.operation.saleId
          }
        ]
      : productionItems.map(item =>
          materialDependency(
            item,
            input.sourcePlans.find(
              plan => plan.productionItemId === item.id
            )
          )
        );

  const decision = decideOperationRelease({
    dependencies
  });

  const context: OperationTransitionContext = {
    release: {
      dependencies
    }
  };

  if (decision.state === "BLOCKED") {
    return {
      context,
      decision,
      label: "BLOKELI",
      nextAction:
        decision.blockers[0]?.message ||
        "Blokeli malzeme kaynağını düzeltin; ardından işi tekrar başlatın."
    };
  }

  if (decision.state === "WAITING_DEPENDENCY") {
    return {
      context,
      decision,
      label: "BEKLIYOR",
      nextAction:
        "Eksik malzeme / kaynak hazırlığını tamamlayın. Hazır olduğunda iş serbest kalır."
    };
  }

  return {
    context,
    decision,
    label: "SERBEST",
    nextAction: "Malzeme bağımlılıkları tamam. İş başlatılabilir."
  };
}