"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  PlusCircle
} from "lucide-react";
import type {
  PaymentMethod,
  Sale,
  SalePayment
} from "@/store/salesStore";
import {
  applyPaymentToSale,
  getOverdueInstallments,
  getSalePaidTotal,
  getSaleRemainingBalance
} from "@/lib/salesFinance";

interface PaymentTrackingPanelProps {
  sale: Sale;
  onChange: (sale: Sale) => void;
}

function formatCurrency(value: number): string {
  return Number(value || 0).toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY"
  });
}

function getTodayText(): string {
  return new Date().toISOString().slice(0, 10);
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  NAKIT: "Nakit",
  KART: "Kart",
  HAVALE: "Havale",
  EFT: "EFT",
  DIGER: "Diğer"
};

export default function PaymentTrackingPanel({
  sale,
  onChange
}: PaymentTrackingPanelProps) {
  const [amount, setAmount] = useState(0);
  const [paidAt, setPaidAt] = useState(getTodayText());
  const [method, setMethod] =
    useState<PaymentMethod>("NAKIT");
  const [installmentId, setInstallmentId] =
    useState("");
  const [note, setNote] = useState("");

  const paidTotal = useMemo(
    () => getSalePaidTotal(sale),
    [sale]
  );

  const remainingBalance = useMemo(
    () => getSaleRemainingBalance(sale),
    [sale]
  );

  const overdueInstallments = useMemo(
    () => getOverdueInstallments(sale),
    [sale]
  );

  const payments = sale.payments || [];

  const handleAddPayment = () => {
    try {
      const payment: SalePayment = {
        id: crypto.randomUUID(),
        amount,
        paidAt,
        method,
        installmentId: installmentId || undefined,
        note: note.trim() || undefined
      };

      const updatedSale = applyPaymentToSale(
        sale,
        payment
      );

      onChange(updatedSale);
      setAmount(0);
      setInstallmentId("");
      setNote("");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Tahsilat kaydedilemedi.";

      alert(message);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm space-y-5">
      <div className="flex items-center gap-2">
        <Banknote className="w-5 h-5 text-emerald-600" />

        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Taksit ve Tahsilat Takibi
          </h2>

          <p className="text-xs text-gray-500">
            Alınan ödemeleri kaydeder ve taksit bakiyelerini günceller.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="text-xs text-gray-500">
            Toplam Tahsilat
          </div>

          <div className="font-bold text-emerald-600">
            {formatCurrency(paidTotal)}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="text-xs text-gray-500">
            Kalan Bakiye
          </div>

          <div className="font-bold text-orange-600">
            {formatCurrency(remainingBalance)}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="text-xs text-gray-500">
            Geciken Taksit
          </div>

          <div className="font-bold text-red-600">
            {overdueInstallments.length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-500">
            Tahsilat Tutarı
          </span>

          <input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={event =>
              setAmount(Number(event.target.value || 0))
            }
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-500">
            Tahsilat Tarihi
          </span>

          <input
            type="date"
            value={paidAt}
            onChange={event =>
              setPaidAt(event.target.value)
            }
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-500">
            Ödeme Yöntemi
          </span>

          <select
            value={method}
            onChange={event =>
              setMethod(
                event.target.value as PaymentMethod
              )
            }
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
          >
            {Object.entries(paymentMethodLabels).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-gray-500">
            Taksit Satırı
          </span>

          <select
            value={installmentId}
            onChange={event =>
              setInstallmentId(event.target.value)
            }
            className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
          >
            <option value="">
              Otomatik en eski açık taksite işle
            </option>

            {(sale.installmentPlan?.installments || []).map(
              installment => (
                <option
                  key={installment.id}
                  value={installment.id}
                >
                  {installment.sequence}. taksit —{" "}
                  {formatCurrency(
                    Math.max(
                      0,
                      installment.amount -
                        installment.paidAmount
                    )
                  )}
                </option>
              )
            )}
          </select>
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="text-xs font-medium text-gray-500">
          Tahsilat Notu
        </span>

        <input
          type="text"
          value={note}
          onChange={event =>
            setNote(event.target.value)
          }
          placeholder="Örn. mağazada nakit alındı"
          className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800"
        />
      </label>

      <button
        type="button"
        onClick={handleAddPayment}
        disabled={
          amount <= 0 ||
          !paidAt ||
          remainingBalance <= 0
        }
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-semibold"
      >
        <PlusCircle className="w-4 h-4" />
        Tahsilat Ekle
      </button>

      {payments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Tahsilat Geçmişi
          </div>

          <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="text-left px-3 py-2">
                    Tarih
                  </th>
                  <th className="text-left px-3 py-2">
                    Yöntem
                  </th>
                  <th className="text-left px-3 py-2">
                    Not
                  </th>
                  <th className="text-right px-3 py-2">
                    Tutar
                  </th>
                </tr>
              </thead>

              <tbody>
                {[...payments]
                  .sort((a, b) =>
                    b.paidAt.localeCompare(a.paidAt)
                  )
                  .map(payment => (
                    <tr
                      key={payment.id}
                      className="border-t border-gray-200 dark:border-gray-800"
                    >
                      <td className="px-3 py-2">
                        {new Date(
                          `${payment.paidAt}T12:00:00`
                        ).toLocaleDateString("tr-TR")}
                      </td>
                      <td className="px-3 py-2">
                        {paymentMethodLabels[payment.method]}
                      </td>
                      <td className="px-3 py-2">
                        {payment.note || "-"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {overdueInstallments.length > 0 && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <Clock3 className="w-4 h-4 mt-0.5 shrink-0" />

          <span>
            {overdueInstallments.length} taksit gecikmiş durumda.
          </span>
        </div>
      )}
    </div>
  );
}