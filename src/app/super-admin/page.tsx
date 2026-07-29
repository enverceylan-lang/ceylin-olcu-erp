"use client";

import {
  useMemo,
  useState
} from "react";
import {
  isPlatformSuperAdmin
} from "@/lib/platformAdminContracts";
import {
  getPackageDisplayLabel
} from "@/lib/packageFeatures";
import {
  useAuthStore
} from "@/store/useAuthStore";
import {
  usePlatformAdminStore
} from "@/store/usePlatformAdminStore";

export default function SuperAdminPage() {
  const currentUser =
    useAuthStore(
      state => state.currentUser
    );

  const companies =
    usePlatformAdminStore(
      state => state.companies
    );

  const selectedCompanyId =
    usePlatformAdminStore(
      state =>
        state.selectedCompanyId
    );

  const selectCompany =
    usePlatformAdminStore(
      state => state.selectCompany
    );

  const previewLicenseUpdate =
    usePlatformAdminStore(
      state =>
        state.previewLicenseUpdate
    );

  const [packageValue, setPackageValue] =
    useState<
      "ECO" |
      "STANDARD" |
      "PLUS"
    >("STANDARD");

  const [licenseActive, setLicenseActive] =
    useState(true);

  const [branchLimit, setBranchLimit] =
    useState(1);

  const [userLimit, setUserLimit] =
    useState(5);

  const [startsAt, setStartsAt] =
    useState("");

  const [endsAt, setEndsAt] =
    useState("");

  const selectedCompany =
    useMemo(
      () =>
        companies.find(
          company =>
            company.companyId ===
            selectedCompanyId
        ),
      [
        companies,
        selectedCompanyId
      ]
    );

  const allowed =
    isPlatformSuperAdmin(
      currentUser
        ? {
            userId: currentUser.id,
            role: String(
              currentUser.role
            )
          }
        : null
    );

  if (!allowed) {
    return (
      <main className="mx-auto max-w-4xl p-4 md:p-6">
        <section className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-bold text-red-900">
            Erişim reddedildi
          </h1>

          <p className="mt-2 text-sm text-red-700">
            Bu alan yalnız
            PLATFORM_SUPER_ADMIN
            rolüne açıktır.
          </p>
        </section>
      </main>
    );
  }

  function handlePreview(): void {
    if (
      !currentUser ||
      !selectedCompany
    ) {
      window.alert(
        "Önce şirket seçilmelidir."
      );
      return;
    }

    const now =
      new Date().toISOString();

    const result =
      previewLicenseUpdate({
        tenantId:
          selectedCompany.tenantId,

        companyId:
          selectedCompany.companyId,

        package: packageValue,
        licenseActive,

        licenseStartsAt:
          startsAt ||
          selectedCompany.licenseStartsAt,

        licenseEndsAt:
          endsAt || undefined,

        branchLimit,
        userLimit,

        changedByUserId:
          currentUser.id,

        changedAt: now
      });

    if (!result.valid) {
      window.alert(
        `Lisans taslağı geçersiz: ${result.reason}`
      );
      return;
    }

    window.alert(
      `Doğrulama geçti. Kalıcı paket kodu: ${result.normalizedPackage}. Sunucuya kaydetme henüz kapalıdır.`
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Süper Admin
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Şirket, lisans ve kullanım
          limitleri yönetim alanı.
        </p>
      </header>

      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        Bu panel satış, cari, stok,
        tahsilat, ödeme, bakiye, kâr
        veya fiyat verisi göstermez.
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Gerçek şirket/lisans okuma ve
        yazma API’si henüz bağlı değildir.
        Sunucuya kaydetme kapalıdır.
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Şirketler
          </h2>

          {companies.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              Gerçek platform şirket
              API’si bağlı olmadığı için
              şirket kaydı yüklenmedi.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {companies.map(company => (
                <button
                  key={company.companyId}
                  type="button"
                  onClick={() =>
                    selectCompany(
                      company.companyId
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50"
                >
                  <div className="font-semibold text-slate-900">
                    {company.companyName}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {company.companyCode}
                    {" · "}
                    {company.packageLabel}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Lisans Taslağı
          </h2>

          {!selectedCompany ? (
            <p className="mt-4 text-sm text-slate-500">
              Düzenleme taslağı için
              şirket seçilmelidir.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 rounded-lg bg-slate-50 p-3 text-sm">
                <strong>
                  {selectedCompany.companyName}
                </strong>

                <div className="mt-1 text-slate-600">
                  Mevcut paket:{" "}
                  {getPackageDisplayLabel(
                    selectedCompany.package
                  )}
                </div>
              </div>

              <label className="text-sm font-medium text-slate-700">
                Paket

                <select
                  value={packageValue}
                  onChange={event =>
                    setPackageValue(
                      event.target.value as
                        | "ECO"
                        | "STANDARD"
                        | "PLUS"
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="ECO">
                    ECO
                  </option>

                  <option value="STANDARD">
                    STANDARD
                  </option>

                  <option value="PLUS">
                    PLUS
                  </option>
                </select>
              </label>

              <label className="flex items-center gap-2 pt-7 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={licenseActive}
                  onChange={event =>
                    setLicenseActive(
                      event.target.checked
                    )
                  }
                />

                Lisans aktif
              </label>

              <label className="text-sm font-medium text-slate-700">
                Şube Limiti

                <input
                  type="number"
                  min={1}
                  value={branchLimit}
                  onChange={event =>
                    setBranchLimit(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Kullanıcı Limiti

                <input
                  type="number"
                  min={1}
                  value={userLimit}
                  onChange={event =>
                    setUserLimit(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Başlangıç

                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={event =>
                    setStartsAt(
                      event.target.value
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Bitiş

                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={event =>
                    setEndsAt(
                      event.target.value
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <button
                type="button"
                onClick={handlePreview}
                className="md:col-span-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Lisans Taslağını Doğrula
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}