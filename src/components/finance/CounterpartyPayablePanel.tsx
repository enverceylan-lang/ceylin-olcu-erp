"use client";

import {
  useMemo
} from "react";
import {
  useErpRuntimeContext
} from "@/lib/useErpRuntimeContext";
import {
  calculateCounterpartyPayableBalance
} from "@/lib/counterpartyPayableService";
import {
  useCounterpartyPayableStore
} from "@/store/useCounterpartyPayableStore";

interface CounterpartyPayablePanelProps {
  customerId: string;
}

function money(
  value: number
): string {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY"
    }
  ).format(value);
}

export function CounterpartyPayablePanel({
  customerId
}: CounterpartyPayablePanelProps) {
  const {
    scope,
    loading,
    error
  } = useErpRuntimeContext();

  const movements =
    useCounterpartyPayableStore(
      state =>
        state.movements
    );

  const scopedMovements =
    useMemo(
      () => {
        if (!scope) {
          return [];
        }

        return movements
          .filter(
            movement =>
              movement.counterpartyCustomerId ===
                customerId &&
              movement.tenantId ===
                scope.tenantId &&
              movement.companyId ===
                scope.companyId &&
              movement.branchId ===
                scope.branchId &&
              movement.accountingPeriodId ===
                scope.accountingPeriodId
          )
          .sort(
            (
              left,
              right
            ) =>
              right.occurredAt
                .localeCompare(
                  left.occurredAt
                )
          );
      },
      [
        customerId,
        movements,
        scope
      ]
    );

  const balance =
    useMemo(
      () =>
        scope
          ? calculateCounterpartyPayableBalance(
              movements,
              scope,
              customerId
            )
          : 0,
      [
        customerId,
        movements,
        scope
      ]
    );

  if (loading) {
    return (
      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        Karşı taraf cari hareketleri yükleniyor…
      </section>
    );
  }

  if (
    error ||
    !scope
  ) {
    return null;
  }

  if (
    scopedMovements.length ===
    0
  ) {
    return null;
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">
            Hizmet / Tedarik Cari Borcu
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            Terzi, montajcı ve tedarikçi borçları müşteri satış tahsilatından ayrı karşı taraf cari defterinden gelir.
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500">
            Açık Borç
          </div>

          <div className="text-lg font-bold text-slate-900">
            {money(balance)}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="px-2 py-2">
                Tarih
              </th>
              <th className="px-2 py-2">
                Tür
              </th>
              <th className="px-2 py-2">
                Kaynak
              </th>
              <th className="px-2 py-2 text-right">
                Tutar
              </th>
            </tr>
          </thead>

          <tbody>
            {scopedMovements.map(
              movement => (
                <tr
                  key={movement.id}
                  className="border-b border-slate-100"
                >
                  <td className="px-2 py-2">
                    {new Date(
                      movement.occurredAt
                    ).toLocaleString(
                      "tr-TR"
                    )}
                  </td>

                  <td className="px-2 py-2">
                    {movement.kind ===
                    "ACCRUAL"
                      ? "Borç"
                      : movement.kind ===
                        "PAYMENT"
                        ? "Ödeme"
                        : "Ters kayıt"}
                  </td>

                  <td className="px-2 py-2">
                    {movement.sourceDocumentId ||
                      movement.operationId ||
                      "-"}
                  </td>

                  <td className="px-2 py-2 text-right font-medium">
                    {movement.kind ===
                    "ACCRUAL"
                      ? "+"
                      : "-"}
                    {money(
                      movement.amount
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}