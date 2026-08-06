import type { SemanticStatusTone } from "@/lib/semanticStatusPalette";

export type WorkflowReadinessCode =
  | "BLOCKED"
  | "WAITING"
  | "READY"
  | "COMPLETE"
  | "CLOSED";

export type WorkflowRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface WorkflowStatusPresentation {
  label: string;
  tone: SemanticStatusTone;
}

export interface WorkflowReadiness {
  code: WorkflowReadinessCode;
  label: string;
  message?: string;
  tone: SemanticStatusTone;
}

export interface WorkflowRiskReason {
  code: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
}

export interface WorkflowRisk {
  level: WorkflowRiskLevel;
  label: string;
  reasons: WorkflowRiskReason[];
  tone: SemanticStatusTone;
}

export interface WorkflowBlocker {
  code: string;
  label: string;
  message?: string;
  source?: string;
}

export interface WorkflowAssignment {
  label: string;
  partyName?: string;
  assignmentType?: "INTERNAL" | "EXTERNAL";
}

export interface WorkflowEvidence {
  id: string;
  kind: "PHOTO" | "VIDEO" | "DOCUMENT" | "NOTE" | "OTHER";
  label: string;
  url?: string;
  createdAt?: string;
}

export interface WorkflowEvent {
  id: string;
  label: string;
  at: string;
  tone?: SemanticStatusTone;
  description?: string;
}

export function readinessTone(
  code: WorkflowReadinessCode
): SemanticStatusTone {
  if (code === "BLOCKED") return "CRITICAL";
  if (code === "READY" || code === "COMPLETE") return "POSITIVE";
  if (code === "CLOSED") return "CLOSED";
  return "PLANNED";
}

export function riskTone(
  level: WorkflowRiskLevel
): SemanticStatusTone {
  if (level === "HIGH") return "CRITICAL";
  if (level === "MEDIUM") return "WARNING";
  return "NEUTRAL";
}

export function toWorkflowEvent(input: {
  code: string;
  label: string;
  occurredAt: string;
}): WorkflowEvent {
  return {
    id: `${input.code}:${input.occurredAt}`,
    label: input.label,
    at: input.occurredAt
  };
}