import type { ReactNode } from "react";
import {
  getSemanticStatusAppearance,
  type SemanticStatusTone
} from "@/lib/semanticStatusPalette";
import type {
  WorkflowAssignment,
  WorkflowBlocker,
  WorkflowEvent,
  WorkflowReadiness,
  WorkflowRisk,
  WorkflowStatusPresentation
} from "@/lib/workflowUiKit";

function badgeToneClasses(tone: SemanticStatusTone): string {
  const appearance = getSemanticStatusAppearance(tone);
  return `${appearance.backgroundClass} ${appearance.textClass} ${appearance.borderClass}`;
}

function dotToneClass(tone: SemanticStatusTone): string {
  return getSemanticStatusAppearance(tone).dotClass;
}

function Badge({
  label,
  tone
}: {
  label: string;
  tone: SemanticStatusTone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeToneClasses(tone)}`}
    >
      {label}
    </span>
  );
}

export function WorkflowStatusBadge({
  status
}: {
  status: WorkflowStatusPresentation;
}) {
  return <Badge label={status.label} tone={status.tone} />;
}

export function WorkflowReadinessBadge({
  readiness
}: {
  readiness: WorkflowReadiness;
}) {
  return <Badge label={readiness.label} tone={readiness.tone} />;
}

export function WorkflowRiskBadge({
  risk
}: {
  risk: WorkflowRisk;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge label={risk.label} tone={risk.tone} />
      {risk.reasons.map(reason => (
        <span
          key={reason.code}
          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
            reason.severity === "CRITICAL"
              ? "bg-red-50 text-red-700"
              : reason.severity === "WARNING"
                ? "bg-amber-50 text-amber-800"
                : "bg-slate-100 text-slate-700"
          }`}
        >
          {reason.message}
        </span>
      ))}
    </div>
  );
}

export function WorkflowBlockerCard({
  blocker
}: {
  blocker: WorkflowBlocker;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100">
      <div className="font-semibold">{blocker.label}</div>
      {blocker.message ? (
        <div className="mt-1 text-xs opacity-90">{blocker.message}</div>
      ) : null}
    </div>
  );
}

export function WorkflowAssignmentChip({
  assignment
}: {
  assignment: WorkflowAssignment;
}) {
  const suffix =
    assignment.assignmentType === "EXTERNAL"
      ? "Dış Partner"
      : assignment.assignmentType === "INTERNAL"
        ? "Şirket İçi"
        : null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      <span>{assignment.partyName || assignment.label}</span>
      {suffix ? <span className="text-[10px] opacity-60">· {suffix}</span> : null}
    </span>
  );
}

export function WorkflowTimeline({
  events,
  emptyState
}: {
  events: WorkflowEvent[];
  emptyState?: ReactNode;
}) {
  if (events.length === 0) {
    return <>{emptyState || null}</>;
  }

  return (
    <ol className="space-y-3">
      {events.map(event => (
        <li key={event.id} className="flex gap-3">
          <span
            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${dotToneClass(event.tone || "NEUTRAL")}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {event.label}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {event.at}
            </div>
            {event.description ? (
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {event.description}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}