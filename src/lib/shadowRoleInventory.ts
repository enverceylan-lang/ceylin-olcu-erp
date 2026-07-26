import type { ErpFeature, ErpPackage } from "./packageFeatures";
import {
  compareShadowFeatureAccess,
  type ShadowAccessRole,
} from "./shadowFeatureAccess";

export const SHADOW_INVENTORY_ROLES: readonly ShadowAccessRole[] = [
  "ADMIN",
  "MODERATOR",
  "OFFICE",
  "FIELD",
  "TAILOR",
  "INSTALLER",
  "ACCOUNTING",
];

export const SHADOW_INVENTORY_PACKAGES: readonly ErpPackage[] = [
  "ECO",
  "NORMAL",
  "PLUS",
];

export interface ShadowRoleInventoryRow {
  role: ShadowAccessRole;
  package: ErpPackage;
  feature: ErpFeature;
  currentAllows: boolean;
  shadowAllows: boolean;
  differenceReason:
    | "PACKAGE_LICENSE_DENIED"
    | "ROLE_DENIED"
    | "USER_DENIED"
    | "SCOPE_DENIED"
    | "OWNERSHIP_DENIED"
    | null;
  differs: boolean;
}

export interface ShadowRoleInventorySummary {
  rowCount: number;
  differenceCount: number;
  byPackage: Record<
    ErpPackage,
    { rowCount: number; differenceCount: number }
  >;
}

export interface PendingAccessDecision {
  id:
    | "ACCOUNTING_NAVIGATION"
    | "MODERATOR_FEATURE_BOUNDARY"
    | "OFFICE_OPERATIONS_BOUNDARY"
    | "TAILOR_PAYROLL_SELF_VIEW"
    | "INSTALLER_PAYROLL_SELF_VIEW"
    | "MULTI_SCOPE_MANAGEMENT";
  status: "DECISION_REQUIRED";
  currentState: string;
  question: string;
  safeDefault: "KEEP_CURRENT_ACCESS";
}

export const PENDING_ACCESS_DECISIONS: readonly PendingAccessDecision[] = [
  {
    id: "ACCOUNTING_NAVIGATION",
    status: "DECISION_REQUIRED",
    currentState:
      "Finans yardımcı izinleri ACCOUNTING rolünü kabul ediyor; genel modül görünürlüğü kabul etmiyor.",
    question:
      "Muhasebe rolünün hangi menülerden finans ve cari alanlarına ulaşacağı belirlenmelidir.",
    safeDefault: "KEEP_CURRENT_ACCESS",
  },
  {
    id: "MODERATOR_FEATURE_BOUNDARY",
    status: "DECISION_REQUIRED",
    currentState:
      "Moderatör Ayarlar dışındaki modülleri görebiliyor; paket özellikleri için ayrı sınır tanımlı değil.",
    question:
      "Moderatörün gelişmiş optimizasyon, kapasite ve çoklu kapsam özellikleri belirlenmelidir.",
    safeDefault: "KEEP_CURRENT_ACCESS",
  },
  {
    id: "OFFICE_OPERATIONS_BOUNDARY",
    status: "DECISION_REQUIRED",
    currentState:
      "Ofis rolü bazı üretim ve montaj kayıtlarını yardımcı izinlerle görebiliyor; ana modül matrisi daha dar.",
    question:
      "Ofisin stok, satın alma, üretim ve montaj operasyonlarındaki görüntüleme/düzenleme sınırı belirlenmelidir.",
    safeDefault: "KEEP_CURRENT_ACCESS",
  },
  {
    id: "TAILOR_PAYROLL_SELF_VIEW",
    status: "DECISION_REQUIRED",
    currentState:
      "Terzi kendisine atanan işi görebiliyor; kendi hakediş/bordro görünürlüğü açıkça tanımlı değil.",
    question:
      "Terzi yalnız kendi hakedişini görebilecek mi?",
    safeDefault: "KEEP_CURRENT_ACCESS",
  },
  {
    id: "INSTALLER_PAYROLL_SELF_VIEW",
    status: "DECISION_REQUIRED",
    currentState:
      "Montajcı kendisine atanan işi görebiliyor; kendi hakediş/bordro görünürlüğü açıkça tanımlı değil.",
    question:
      "Montajcı yalnız kendi hakedişini görebilecek mi?",
    safeDefault: "KEEP_CURRENT_ACCESS",
  },
  {
    id: "MULTI_SCOPE_MANAGEMENT",
    status: "DECISION_REQUIRED",
    currentState:
      "Çoklu şube/depo özellikleri paket kataloğunda var; yönetebilecek roller belirlenmedi.",
    question:
      "Şirket, şube, dönem ve depo kapsamını hangi roller seçebilir veya yönetebilir?",
    safeDefault: "KEEP_CURRENT_ACCESS",
  },
];

export function buildShadowRoleInventory(): ShadowRoleInventoryRow[] {
  return SHADOW_INVENTORY_ROLES.flatMap((role) =>
    SHADOW_INVENTORY_PACKAGES.flatMap((erpPackage) =>
      compareShadowFeatureAccess({
        role,
        package: erpPackage,
      }).map((comparison) => ({
        role,
        package: erpPackage,
        feature: comparison.feature,
        currentAllows: comparison.currentAllows,
        shadowAllows: comparison.shadowDecision.allowed,
        differenceReason: comparison.shadowDecision.allowed
          ? null
          : comparison.shadowDecision.reason,
        differs: comparison.differs,
      }))
    )
  );
}

export function summarizeShadowRoleInventory(
  rows: readonly ShadowRoleInventoryRow[]
): ShadowRoleInventorySummary {
  const packageSummary = (erpPackage: ErpPackage) => {
    const packageRows = rows.filter((row) => row.package === erpPackage);
    return {
      rowCount: packageRows.length,
      differenceCount: packageRows.filter((row) => row.differs).length,
    };
  };

  return {
    rowCount: rows.length,
    differenceCount: rows.filter((row) => row.differs).length,
    byPackage: {
      ECO: packageSummary("ECO"),
      NORMAL: packageSummary("NORMAL"),
      PLUS: packageSummary("PLUS"),
    },
  };
}
