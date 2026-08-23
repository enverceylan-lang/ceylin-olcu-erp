"use client";

import { useMemo, useState } from "react";

import { useErpRuntimeContext } from "@/lib/useErpRuntimeContext";
import type {
  ServiceProviderType,
  ServiceRateUnit,
} from "@/lib/serviceRateEngine";
import { useServiceRateStore } from "@/store/useServiceRateStore";
import { useStore } from "@/store/useStore";

interface ServiceRatePanelProps {
  serviceStockItemId: string;
  serviceName: string;
}

function makeId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    "service-rate",
    Date.now(),
    Math.random()
      .toString(16)
      .slice(2),
  ].join("-");
}

function toIsoStart(
  value: string,
): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(
    `${value}T00:00:00`,
  );

  return Number.isFinite(
    parsed.getTime(),
  )
    ? parsed.toISOString()
    : null;
}

function money(
  value: number,
): string {
  return value.toLocaleString(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY",
    },
  );
}

export function ServiceRatePanel({
  serviceStockItemId,
  serviceName,
}: ServiceRatePanelProps) {
  const {
    scope,
    loading,
    error,
  } = useErpRuntimeContext();

  const customers = useStore(
    state => state.customers,
  );

  const rates = useServiceRateStore(
    state => state.rates,
  );

  const addRate = useServiceRateStore(
    state => state.addRate,
  );

  const [providerType, setProviderType] =
    useState<ServiceProviderType>(
      "TAILOR",
    );

  const [
    providerCustomerId,
    setProviderCustomerId,
  ] = useState("");

  const [unit, setUnit] =
    useState<ServiceRateUnit>(
      "METER",
    );

  const [unitPrice, setUnitPrice] =
    useState("");

  const [validFrom, setValidFrom] =
    useState(
      new Date()
        .toISOString()
        .slice(0, 10),
    );

  const [validTo, setValidTo] =
    useState("");

  const [message, setMessage] =
    useState<string | null>(
      null,
    );

  const providers = useMemo(
    () =>
      customers
        .filter(customer => {
          if (
            customer.isDeleted ===
              true ||
            customer.isArchived ===
              true
          ) {
            return false;
          }

          return (
            customer.cariType ===
            providerType
          );
        })
        .sort((left, right) =>
          left.name.localeCompare(
            right.name,
            "tr",
          ),
        ),
    [customers, providerType],
  );

  const scopedRates = useMemo(
    () => {
      if (!scope) {
        return [];
      }

      return rates
        .filter(rate =>
          rate.tenantId ===
            scope.tenantId &&
          rate.companyId ===
            scope.companyId &&
          rate.branchId ===
            scope.branchId &&
          rate.accountingPeriodId ===
            scope.accountingPeriodId &&
          rate.serviceStockItemId ===
            serviceStockItemId
        )
        .sort(
          (left, right) =>
            new Date(
              right.validFrom,
            ).getTime() -
            new Date(
              left.validFrom,
            ).getTime(),
        );
    },
    [
      rates,
      scope,
      serviceStockItemId,
    ],
  );

  const handleAdd = () => {
    setMessage(null);

    if (!scope) {
      setMessage(
        "Aktif ERP kapsamı hazır değil.",
      );
      return;
    }

    if (!providerCustomerId) {
      setMessage(
        "Sağlayıcı cari seçilmelidir.",
      );
      return;
    }

    const price = Number(
      unitPrice
        .replace(",", ".")
        .trim(),
    );

    if (
      !Number.isFinite(price) ||
      price < 0
    ) {
      setMessage(
        "Geçerli bir birim fiyat girilmelidir.",
      );
      return;
    }

    const fromIso =
      toIsoStart(validFrom);

    if (!fromIso) {
      setMessage(
        "Geçerlilik başlangıç tarihi zorunludur.",
      );
      return;
    }

    const toIso =
      validTo
        ? toIsoStart(validTo)
        : null;

    if (
      validTo &&
      !toIso
    ) {
      setMessage(
        "Geçerlilik bitiş tarihi geçersiz.",
      );
      return;
    }

    const now =
      new Date().toISOString();

    const result = addRate({
      ...scope,
      id: makeId(),
      providerCustomerId,
      providerType,
      serviceStockItemId,
      unit,
      unitPrice: price,
      currency: "TRY",
      validFrom: fromIso,
      validTo: toIso,
      active: true,
      createdAt: now,
    });

    if (
      result.outcome ===
      "REJECTED"
    ) {
      setMessage(
        `Tarife kaydedilemedi: ${result.reason}`,
      );
      return;
    }

    setMessage(
      result.outcome === "REPLAY"
        ? "Tarife zaten kayıtlı."
        : "Yeni tarihsel tarife kaydedildi.",
    );

    setUnitPrice("");
  };

  if (loading) {
    return (
      <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <div className="text-sm text-gray-500">
          Sağlayıcı tarifeleri yükleniyor...
        </div>
      </section>
    );
  }

  if (error || !scope) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
        <div className="text-sm font-medium text-red-700 dark:text-red-300">
          Aktif ERP kapsamı alınamadığı için tarife girişi kapalıdır.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          Sağlayıcı Tarifeleri
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {serviceName} için terzi veya montajcı bazlı tarihsel fiyat girilir.
          Eski kayıt değiştirilmez; yeni fiyat yeni tarihli tarife olarak eklenir.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
          {message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Sağlayıcı Tipi
          <select
            value={providerType}
            onChange={event => {
              setProviderType(
                event.target.value as
                  ServiceProviderType,
              );
              setProviderCustomerId("");
            }}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="TAILOR">
              Terzi
            </option>
            <option value="INSTALLER">
              Montajcı
            </option>
          </select>
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300 lg:col-span-2">
          Sağlayıcı Cari
          <select
            value={providerCustomerId}
            onChange={event =>
              setProviderCustomerId(
                event.target.value,
              )
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="">
              Seçiniz
            </option>
            {providers.map(
              provider => (
                <option
                  key={provider.id}
                  value={provider.id}
                >
                  {provider.name}
                </option>
              ),
            )}
          </select>
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Birim
          <select
            value={unit}
            onChange={event =>
              setUnit(
                event.target.value as
                  ServiceRateUnit,
              )
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          >
            <option value="METER">
              Metre
            </option>
            <option value="M2">
              m²
            </option>
            <option value="UNIT">
              Adet
            </option>
            <option value="JOB">
              İş
            </option>
          </select>
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Birim Fiyat
          <input
            inputMode="decimal"
            value={unitPrice}
            onChange={event =>
              setUnitPrice(
                event.target.value,
              )
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Başlangıç
          <input
            type="date"
            value={validFrom}
            onChange={event =>
              setValidFrom(
                event.target.value,
              )
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Bitiş
          <input
            type="date"
            value={validTo}
            onChange={event =>
              setValidTo(
                event.target.value,
              )
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
        >
          Yeni Tarifeyi Kaydet
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-950/50">
            <tr>
              <th className="p-3">
                Sağlayıcı
              </th>
              <th className="p-3">
                Tip
              </th>
              <th className="p-3">
                Birim
              </th>
              <th className="p-3 text-right">
                Fiyat
              </th>
              <th className="p-3">
                Başlangıç
              </th>
              <th className="p-3">
                Bitiş
              </th>
            </tr>
          </thead>
          <tbody>
            {scopedRates.map(rate => {
              const provider =
                customers.find(
                  customer =>
                    customer.id ===
                    rate.providerCustomerId,
                );

              return (
                <tr
                  key={rate.id}
                  className="border-t border-gray-100 dark:border-gray-800"
                >
                  <td className="p-3 font-medium text-gray-900 dark:text-white">
                    {provider?.name ??
                      rate.providerCustomerId}
                  </td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">
                    {rate.providerType ===
                    "TAILOR"
                      ? "Terzi"
                      : "Montajcı"}
                  </td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">
                    {rate.unit}
                  </td>
                  <td className="p-3 text-right font-semibold text-gray-900 dark:text-white">
                    {money(
                      rate.unitPrice,
                    )}
                  </td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">
                    {rate.validFrom.slice(
                      0,
                      10,
                    )}
                  </td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">
                    {rate.validTo
                      ? rate.validTo.slice(
                          0,
                          10,
                        )
                      : "Açık"}
                  </td>
                </tr>
              );
            })}

            {scopedRates.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-5 text-center text-gray-500"
                >
                  Bu hizmet için henüz tarife yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}