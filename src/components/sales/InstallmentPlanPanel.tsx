"use client";

import { useMemo, useState } from "react";
import { CalendarDays, CreditCard, Plus } from "lucide-react";
import type { Sale } from "@/store/salesStore";
import {
  createEqualInstallmentPlan,
  getSaleRemainingBalance,
  refreshInstallmentPlan
} from "@/lib/salesFinance";

interface InstallmentPlanPanelProps {
  sale: Sale;
  onChange: (sale: Sale) => void;
}

function formatCurrency(value: number): string {
  return Number(value || 0).toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY"
  });
}

function getDefaultFirstDueDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export default function InstallmentPlanPanel({
  sale,
  onChange
}: InstallmentPlanPanelProps) {
  const [installmentCount, setInstallmentCount] =
    useState(
      sale.installmentPlan?.installmentCount || 3
    );

  const [firstDueDate, setFirstDueDate] =
    useState(
      sale.installmentPlan?.firstDueDate ||
        getDefaultFirstDueDate()
    );

  const remainingBalance = useMemo(
    () => getSaleRemainingBalance(sale),
    [sale]
  );

  const installmentPlan = useMemo(
    () => refreshInstallmentPlan(sale.installmentPlan),
    [sale.installmentPlan]
  );

  const handleCreatePlan = () => {
    try {
      const plan = createEqualInstallmentPlan({
        totalAmount: remainingBalance,
        installmentCount,
        firstDueDate
      });

      onChange({
        ...sale,
        installmentPlan: plan,
        remainingBalance,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Taksit planı oluşturulamadı.";

      alert(message);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm space-y-5">
      <div className="flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-blue-600" />

        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Taksit Planı
          </h2>

          <p className="text-xs text-gray-500">
            Kalan bakiye üzerinden eşit aylık taksit oluşturur.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-500">
            Taksit Sayısı
          </span>

          <input
            type="number"
            min={1}
            max={60}
            value={installmentCount}
            onChange={event =>
              setInstallmentCount(
                Math.max(
                  1,
                  Number(event.target.value || 1)
                )
              )
            }
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-500">
            İlk Vade Tarihi
          </span>

          <input
            type="date"
            value={firstDueDate}
            onChange={event =>
              setFirstDueDate(event.target.value)
            }
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
          />
        </label>
      </div>

      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 p-3">
        <div className="text-xs text-gray-500">
          Taksitlendirilecek Kalan Bakiye
        </div>

        <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
          {formatCurrency(remainingBalance)}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCreatePlan}
        disabled={
          remainingBalance <= 0 ||
          !firstDueDate ||
          installmentCount <= 0
        }
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold"
      >
        <Plus className="w-4 h-4" />
        Eşit Taksit Planı Oluştur
      </button>

      {installmentPlan &&
        installmentPlan.installments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="w-4 h-4" />
              Taksitler
            </div>

            <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="text-left px-3 py-2">
                      No
                    </th>
                    <th className="text-left px-3 py-2">
                      Vade
                    </th>
                    <th className="text-right px-3 py-2">
                      Tutar
                    </th>
                    <th className="text-right px-3 py-2">
                      Ödenen
                    </th>
                    <th className="text-left px-3 py-2">
                      Durum
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {installmentPlan.installments.map(
                    installment => (
                      <tr
                        key={installment.id}
                        className="border-t border-gray-200 dark:border-gray-800"
                      >
                        <td className="px-3 py-2">
                          {installment.sequence}
                        </td>
                        <td className="px-3 py-2">
                          {new Date(
                            `${installment.dueDate}T12:00:00`
                          ).toLocaleDateString("tr-TR")}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(
                            installment.amount
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(
                            installment.paidAmount
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {installment.status}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
}