"use client";

import { useEffect, useMemo, useState } from "react";

import {
  readCustomerReceivableSnapshot,
} from "@/lib/finance/customerReceivableReadClient";
import type {
  CustomerReceivableSnapshot,
} from "@/lib/finance/customerReceivableReadContracts";
import {
  useFinanceRuntimeContext,
} from "@/lib/finance/useFinanceRuntimeContext";

import { FinanceAccessState } from "./FinanceAccessState";

interface CustomerFinancePanelProps {
  customerId: string;
  currency?: string;
}

interface StatementLine {
  id: string;
  occurredAt: string;
  documentNumber: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
  }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR").format(date);
}

function buildStatement(snapshot: CustomerReceivableSnapshot): StatementLine[] {
  const metadata = new Map(
    snapshot.transactionMetadata.map((row) => [row.transactionId, row] as const),
  );

  const events: Array<Omit<StatementLine, "runningBalance">> = [];

  for (const item of snapshot.openItems) {
    if (item.status === "REVERSED") continue;
    events.push({
      id: `SALE:${item.id}`,
      occurredAt: item.createdAt,
      documentNumber: item.documentNumber,
      description:
        item.installmentId === null
          ? `Satış borcu: ${item.documentNumber}`
          : `Taksit borcu: ${item.documentNumber} / ${item.sequenceNo}`,
      debitAmount: item.originalAmount,
      creditAmount: 0,
    });
  }

  for (const allocation of snapshot.allocations) {
    if (allocation.reversedAt !== null) continue;
    const tx = metadata.get(allocation.transactionId);
    events.push({
      id: `COLLECTION:${allocation.id}`,
      occurredAt: tx?.createdAt || allocation.createdAt,
      documentNumber: allocation.saleId,
      description: tx?.description || "Tahsilat",
      debitAmount: 0,
      creditAmount: allocation.amount,
    });
  }

  events.sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.id.localeCompare(right.id),
  );

  let runningBalance = 0;
  return events.map((event) => {
    runningBalance =
      Math.round(
        (runningBalance + event.debitAmount - event.creditAmount) * 100,
      ) / 100;
    return {
      ...event,
      runningBalance,
    };
  });
}

export function CustomerFinancePanel({
  customerId,
  currency = "TRY",
}: CustomerFinancePanelProps) {
  const runtime = useFinanceRuntimeContext();
  const requestKey = `${customerId.trim()}|${currency.trim().toUpperCase()}`;
  const [readState, setReadState] = useState<{
    key: string;
    snapshot: CustomerReceivableSnapshot | null;
    error: string | null;
  } | null>(null);

  const snapshot =
    readState?.key === requestKey ? readState.snapshot : null;
  const error =
    readState?.key === requestKey ? readState.error : null;
  const loading =
    runtime.state === "ready" && readState?.key !== requestKey;

  useEffect(() => {
    if (runtime.state !== "ready") {
      return;
    }

    const controller = new AbortController();

    readCustomerReceivableSnapshot(customerId, currency, {
      signal: controller.signal,
    })
      .then((next) => {
        if (controller.signal.aborted) return;
        setReadState({
          key: requestKey,
          snapshot: next,
          error: null,
        });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setReadState({
          key: requestKey,
          snapshot: null,
          error:
            cause instanceof Error
              ? cause.message
              : "FINANCE_CUSTOMER_RECEIVABLE_READ_FAILED",
        });
      });

    return () => controller.abort();
  }, [customerId, currency, requestKey, runtime]);

  const statement = useMemo(
    () => (snapshot ? buildStatement(snapshot) : []),
    [snapshot],
  );

  if (runtime.state === "loading" || loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        Cari finans verileri doğrulanıyor…
      </div>
    );
  }

  if (runtime.state !== "ready") {
    return <FinanceAccessState reason={runtime.reason} />;
  }

  if (error) {
    return <FinanceAccessState reason={error} />;
  }

  if (!snapshot) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
        Merkezi Cari Finans verisi alınamadı.
      </div>
    );
  }

  const cards = [
    ["Cari Bakiye", snapshot.summary.currentBalance],
    ["Toplam Borç", snapshot.summary.originalDebtTotal],
    ["Toplam Alacak", snapshot.summary.allocatedCollectionTotal],
    ["Gecikmiş", snapshot.due.overdueAmount],
    ["Bugün Vadeli", snapshot.due.dueTodayAmount],
    ["Gelecek Vadeli", snapshot.due.futureAmount],
  ] as const;

  const activeOpenItems = snapshot.openItems.filter(
    (item) =>
      (item.status === "OPEN" || item.status === "PARTIAL") &&
      item.remainingAmount > 0,
  );

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4">
          <h3 className="font-semibold text-gray-950 dark:text-white">
            Cari Finans
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Finans merkezindeki merkezi kayıtlardan okunur. Cari ekran ayrı finans
            kaydı tutmaz.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800"
            >
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {label}
              </div>
              <div className="mt-1 text-lg font-bold text-gray-950 dark:text-white">
                {formatMoney(value, currency)}
              </div>
            </div>
          ))}
        </div>

        {snapshot.summary.reservedTotal > 0 ? (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">
            Ayrılmış / rezerv tutar:{" "}
            {formatMoney(snapshot.summary.reservedTotal, currency)}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-5 dark:border-gray-800">
          <h3 className="font-semibold text-gray-950 dark:text-white">
            Cari Ekstre
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Açılış: {formatMoney(0, currency)} · Kapanış:{" "}
            {formatMoney(snapshot.summary.currentBalance, currency)}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3">Belge</th>
                <th className="px-4 py-3">Açıklama</th>
                <th className="px-4 py-3 text-right">Borç</th>
                <th className="px-4 py-3 text-right">Alacak</th>
                <th className="px-4 py-3 text-right">Bakiye</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {statement.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    Bu cariye ait merkezi finans hareketi bulunamadı.
                  </td>
                </tr>
              ) : (
                statement.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">{formatDate(line.occurredAt)}</td>
                    <td className="px-4 py-3">{line.documentNumber}</td>
                    <td className="px-4 py-3">{line.description}</td>
                    <td className="px-4 py-3 text-right">
                      {line.debitAmount > 0
                        ? formatMoney(line.debitAmount, currency)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {line.creditAmount > 0
                        ? formatMoney(line.creditAmount, currency)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatMoney(line.runningBalance, currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-5 dark:border-gray-800">
          <h3 className="font-semibold text-gray-950 dark:text-white">
            Açık Vadeli Borçlar
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="p-4">Belge</th>
                <th className="p-4">Vade</th>
                <th className="p-4 text-right">İlk Borç</th>
                <th className="p-4 text-right">Tahsil Edilen</th>
                <th className="p-4 text-right">Kalan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {activeOpenItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    Açık vadeli borç bulunmuyor.
                  </td>
                </tr>
              ) : (
                activeOpenItems.map((item) => (
                  <tr key={item.id}>
                    <td className="p-4">{item.documentNumber}</td>
                    <td className="p-4">{formatDate(item.dueDate)}</td>
                    <td className="p-4 text-right">
                      {formatMoney(item.originalAmount, currency)}
                    </td>
                    <td className="p-4 text-right">
                      {formatMoney(item.allocatedAmount, currency)}
                    </td>
                    <td className="p-4 text-right font-bold text-gray-900 dark:text-white">
                      {formatMoney(item.remainingAmount, currency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}