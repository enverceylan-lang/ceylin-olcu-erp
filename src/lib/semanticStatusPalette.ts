export type SemanticStatusTone =
  | "POSITIVE"
  | "ATTENTION"
  | "WARNING"
  | "CRITICAL"
  | "IN_PROGRESS"
  | "PLANNED"
  | "CLOSED"
  | "NEUTRAL";

export interface SemanticStatusAppearance {
  tone: SemanticStatusTone;
  label: string;
  backgroundClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
}

export const SEMANTIC_STATUS_APPEARANCES: Record<
  SemanticStatusTone,
  SemanticStatusAppearance
> = {
  POSITIVE: {
    tone: "POSITIVE",
    label: "Olumlu / Hazır / Düzenli",
    backgroundClass: "bg-green-50",
    textClass: "text-green-800",
    borderClass: "border-green-200",
    dotClass: "bg-green-500"
  },

  ATTENTION: {
    tone: "ATTENTION",
    label: "Dikkat / Bekliyor",
    backgroundClass: "bg-yellow-50",
    textClass: "text-yellow-800",
    borderClass: "border-yellow-200",
    dotClass: "bg-yellow-400"
  },

  WARNING: {
    tone: "WARNING",
    label: "Risk Artıyor / Gecikme",
    backgroundClass: "bg-orange-50",
    textClass: "text-orange-800",
    borderClass: "border-orange-200",
    dotClass: "bg-orange-500"
  },

  CRITICAL: {
    tone: "CRITICAL",
    label: "Sorun / Kritik / Yüksek Risk",
    backgroundClass: "bg-red-50",
    textClass: "text-red-800",
    borderClass: "border-red-200",
    dotClass: "bg-red-500"
  },

  IN_PROGRESS: {
    tone: "IN_PROGRESS",
    label: "İşlem Sürüyor",
    backgroundClass: "bg-blue-50",
    textClass: "text-blue-800",
    borderClass: "border-blue-200",
    dotClass: "bg-blue-500"
  },

  PLANNED: {
    tone: "PLANNED",
    label: "Planlandı / Randevu Verildi",
    backgroundClass: "bg-purple-50",
    textClass: "text-purple-800",
    borderClass: "border-purple-200",
    dotClass: "bg-purple-500"
  },

  CLOSED: {
    tone: "CLOSED",
    label: "Tamamlandı / Teslim Edildi / Kapandı",
    backgroundClass: "bg-slate-100",
    textClass: "text-slate-700",
    borderClass: "border-slate-300",
    dotClass: "bg-slate-500"
  },

  NEUTRAL: {
    tone: "NEUTRAL",
    label: "Yeni / Taslak / Bilgi",
    backgroundClass: "bg-gray-50",
    textClass: "text-gray-700",
    borderClass: "border-gray-200",
    dotClass: "bg-gray-400"
  }
};

export function getSemanticStatusAppearance(
  tone: SemanticStatusTone
): SemanticStatusAppearance {
  return SEMANTIC_STATUS_APPEARANCES[tone];
}

export function getRiskTone(
  riskScore: number
): SemanticStatusTone {
  const safeScore = Math.max(
    0,
    Math.min(100, riskScore)
  );

  if (safeScore <= 20) {
    return "POSITIVE";
  }

  if (safeScore <= 40) {
    return "ATTENTION";
  }

  if (safeScore <= 60) {
    return "WARNING";
  }

  return "CRITICAL";
}

export function normalizeRiskScore(
  riskScore: number
): number {
  if (!Number.isFinite(riskScore)) {
    return 100;
  }

  return Math.round(
    Math.max(
      0,
      Math.min(100, riskScore)
    )
  );
}