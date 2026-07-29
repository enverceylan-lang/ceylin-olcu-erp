"use client";

import { useState } from "react";

import type {
  OperationRecord
} from "@/lib/operationsWorkflow";
import {
  buildOperationProgressSummary
} from "@/lib/operationProgressService";
import {
  getOperationKindLabel,
  getOperationStatusLabel
} from "@/lib/operationOutputService";

interface OperationChildSummaryProps {
  parent: OperationRecord;
  operations: OperationRecord[];
}

function formatDate(
  value: string
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Tarih yok";
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "short",
      timeStyle: "short"
    }
  ).format(date);
}

function statusClass(
  status: OperationRecord["status"]
): string {
  if (status === "COMPLETED") {
    return "bg-gray-100 text-gray-700";
  }

  if (status === "PROBLEM") {
    return "bg-red-100 text-red-700";
  }

  if (status === "CANCELLED") {
    return "bg-gray-100 text-gray-500 line-through";
  }

  if (status === "IN_PROGRESS") {
    return "bg-blue-100 text-blue-700";
  }

  if (
    status === "ASSIGNED" ||
    status === "SENT" ||
    status === "ACCEPTED"
  ) {
    return "bg-yellow-100 text-yellow-800";
  }

  return "bg-purple-100 text-purple-700";
}

export default function OperationChildSummary({
  parent,
  operations
}: OperationChildSummaryProps) {
  const [referenceNow] =
    useState(() =>
      new Date().getTime()
    );

  const summary =
    buildOperationProgressSummary(
      parent,
      operations
    );

  if (!summary.hasChildren) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">
          Henüz bağlı alt iş oluşturulmadı.
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Yönlendir düğmesiyle Terzi, Tedarikçi veya Montaj işi oluşturabilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-semibold text-slate-900">
            Alt İşler
          </h4>

          <p className="text-xs text-slate-500">
            {summary.total} bağlı iş
            {" · "}
            {summary.completed} tamamlandı
            {" · "}
            {summary.active} aktif
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {summary.problem > 0 ? (
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
              {summary.problem} sorunlu
            </span>
          ) : null}

          {summary.cancelled > 0 ? (
            <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-bold text-gray-600">
              {summary.cancelled} iptal
            </span>
          ) : null}

          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">
            %{summary.progressPercent}
          </span>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{
            width:
              `${summary.progressPercent}%`
          }}
        />
      </div>

      <div className="mt-4 space-y-2">
        {summary.children.map(
          operation => (
            <article
              key={operation.id}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">
                      {getOperationKindLabel(
                        operation
                      )}
                    </span>

                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-[11px] font-bold",
                        statusClass(
                          operation.status
                        )
                      ].join(" ")}
                    >
                      {getOperationStatusLabel(
                        operation.status
                      )}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {operation.party?.name ||
                      "Görevli belirtilmedi"}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Termin:{" "}
                    {formatDate(
                      operation.dueAt
                    )}
                  </p>
                </div>

                {operation.status !==
                  "COMPLETED" &&
                operation.status !==
                  "CANCELLED" &&
                new Date(
                  operation.dueAt
                ).getTime() <
                  referenceNow ? (
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-bold text-orange-700">
                    Gecikmiş
                  </span>
                ) : null}
              </div>

              {operation.notes ? (
                <p className="mt-2 text-xs text-slate-600">
                  {operation.notes}
                </p>
              ) : null}
            </article>
          )
        )}
      </div>
    </section>
  );
}