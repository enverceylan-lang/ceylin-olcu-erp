"use client";

import {
  useMemo,
  useState
} from "react";
import {
  Building2,
  CircleAlert,
  Info,
  KeyRound,
  Laptop,
  Monitor,
  Plus,
  Search,
  ShieldCheck,
  Smartphone,
  UserRoundPlus,
  X
} from "lucide-react";
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

type DraftPanel =
  | "company"
  | "license"
  | "admin"
  | null;

const fieldClassName =
  "mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export default function SuperAdminPage() {
  const currentUser = useAuthStore(
    state => state.currentUser
  );
  const companies = usePlatformAdminStore(
    state => state.companies
  );
  const selectedCompanyId =
    usePlatformAdminStore(
      state => state.selectedCompanyId
    );
  const selectCompany =
    usePlatformAdminStore(
      state => state.selectCompany
    );
  const previewLicenseUpdate =
    usePlatformAdminStore(
      state => state.previewLicenseUpdate
    );

  const [packageValue, setPackageValue] =
    useState<"ECO" | "STANDARD" | "PLUS">(
      "STANDARD"
    );
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
  const [draftPanel, setDraftPanel] =
    useState<DraftPanel>(null);
  const [notice, setNotice] =
    useState<string | null>(null);
  const [searchValue, setSearchValue] =
    useState("");
  const [statusFilter, setStatusFilter] =
    useState<"all" | "active" | "passive">(
      "all"
    );
  const [companyDraft, setCompanyDraft] =
    useState({
      name: "",
      code: "",
      slug: "",
      status: "active"
    });
  const [adminDraft, setAdminDraft] =
    useState({
      fullName: "",
      email: "",
      phone: ""
    });

  const selectedCompany = useMemo(
    () =>
      companies.find(
        company =>
          company.companyId ===
          selectedCompanyId
      ),
    [companies, selectedCompanyId]
  );

  const filteredCompanies = useMemo(() => {
    const query = searchValue
      .trim()
      .toLocaleLowerCase("tr");

    return companies.filter(company => {
      const matchesQuery =
        query.length === 0 ||
        company.companyName
          .toLocaleLowerCase("tr")
          .includes(query) ||
        company.companyCode
          .toLocaleLowerCase("tr")
          .includes(query) ||
        company.companySlug
          .toLocaleLowerCase("tr")
          .includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" &&
          company.licenseActive) ||
        (statusFilter === "passive" &&
          !company.licenseActive);

      return matchesQuery && matchesStatus;
    });
  }, [companies, searchValue, statusFilter]);

  const allowed = isPlatformSuperAdmin(
    currentUser
      ? {
          userId: currentUser.id,
          role: String(currentUser.role)
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
            Bu alan yalnız PLATFORM_SUPER_ADMIN
            rolüne açıktır.
          </p>
        </section>
      </main>
    );
  }

  function openCompanyDraft(): void {
    setNotice(null);
    setDraftPanel("company");
  }

  function openCompanyPanel(
    panel: "license" | "admin"
  ): void {
    if (!selectedCompany) {
      setNotice(
        panel === "license"
          ? "Lisans yönetimi için önce bir şirket seçin."
          : "Yönetici atamak için önce bir şirket seçin."
      );
      return;
    }

    setNotice(null);
    setDraftPanel(panel);
  }

  function handlePreview(): void {
    if (!currentUser || !selectedCompany) {
      setNotice(
        "Lisans yönetimi için önce bir şirket seçin."
      );
      setDraftPanel(null);
      return;
    }

    const result = previewLicenseUpdate({
      tenantId: selectedCompany.tenantId,
      companyId: selectedCompany.companyId,
      package: packageValue,
      licenseActive,
      licenseStartsAt:
        startsAt ||
        selectedCompany.licenseStartsAt,
      licenseEndsAt: endsAt || undefined,
      branchLimit,
      userLimit,
      changedByUserId: currentUser.id,
      changedAt: new Date().toISOString()
    });

    if (!result.valid) {
      setNotice(
        `Lisans taslağı geçersiz: ${result.reason}`
      );
      return;
    }

    setNotice(
      `Taslak doğrulandı (${result.normalizedPackage}). Canlı lisans yazma servisi henüz bağlı değildir; sunucuya kayıt yapılmadı.`
    );
    setDraftPanel(null);
  }

  const summaryCards = [
    {
      label: "Toplam Şirket",
      description: "Platforma bağlı şirketler",
      icon: Building2
    },
    {
      label: "Aktif Lisans",
      description: "Geçerli abonelikler",
      icon: ShieldCheck
    },
    {
      label: "WEB Açık",
      description: "WEB kanal erişimi",
      icon: Monitor
    },
    {
      label: "MOBILE Açık",
      description: "Mobil kanal erişimi",
      icon: Smartphone
    }
  ];

  const channelPlaceholders = [
    { label: "WEB", icon: Monitor },
    { label: "MOBILE", icon: Smartphone },
    { label: "DESKTOP", icon: Laptop }
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 pb-24 md:p-6">
      <header className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-6 shadow-lg shadow-slate-950/10 md:px-7 md:py-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-[-0.04em] text-white md:text-5xl">
                ENVERP
              </h1>
              <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
                Platform Yetkilisi
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-100 md:text-2xl">
              Platform Yönetimi
            </h2>
            <p className="mt-1 text-xs font-semibold tracking-[0.16em] text-cyan-400">
              Entegre Net Veri
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
              Şirketler, lisanslar, kanal erişimleri
              ve platform kullanım sınırlarını merkezi
              olarak yönetin.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openCompanyDraft}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <Plus className="h-4 w-4" />
              Yeni Şirket
            </button>
            <button
              type="button"
              onClick={() => openCompanyPanel("license")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <KeyRound className="h-4 w-4" />
              Lisans Yönet
            </button>
            <button
              type="button"
              onClick={() => openCompanyPanel("admin")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <UserRoundPlus className="h-4 w-4" />
              Yönetici Ata
            </button>
          </div>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className="flex items-start justify-between gap-4 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950 dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-100"
        >
          <span className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Bildirimi kapat"
            className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section aria-label="Platform özeti" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="rounded-lg bg-cyan-50 p-2 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {card.label}
                  </p>
                  <span className="text-xl font-bold text-slate-400">—</span>
                </div>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {card.description}
                </p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-2 md:divide-x md:divide-slate-200 dark:md:divide-slate-800">
          <div className="flex items-start gap-3 md:pr-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" />
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Veri İzolasyonu</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Bu panel operasyonel finans verisi göstermez.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 md:pl-4">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">API Durumu</p>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">Bağlantı Bekliyor</span>
              <p className="w-full text-xs text-slate-500 dark:text-slate-400">Şirket/lisans canlı yazma servisi henüz bağlı değil.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Şirketler</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ENVERP platformuna bağlı şirket hesapları</p>
              </div>
              <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {companies.length === 0 ? "—" : companies.length} kayıt
              </span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_8rem]">
              <label className="relative block">
                <span className="sr-only">Şirket ara</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchValue}
                  onChange={event => setSearchValue(event.target.value)}
                  placeholder="Şirket adı, kodu veya slug ara"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950/60 dark:text-white"
                />
              </label>
              <label>
                <span className="sr-only">Durum filtresi</span>
                <select
                  value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value as "all" | "active" | "passive")}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300"
                >
                  <option value="all">Tümü</option>
                  <option value="active">Aktif</option>
                  <option value="passive">Pasif</option>
                </select>
              </label>
            </div>
          </div>

          {companies.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-9 text-center">
              <span className="rounded-xl bg-slate-100 p-3 text-slate-400 dark:bg-slate-950/70 dark:text-slate-500">
                <Building2 className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Henüz şirket verisi yüklenmedi.</h3>
              <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">Platform şirket API’si bağlandığında şirket hesapları burada listelenecek.</p>
              <button
                type="button"
                onClick={openCompanyDraft}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:text-slate-200 dark:hover:text-cyan-300"
              >
                <Plus className="h-4 w-4" />
                Yeni Şirket
              </button>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Arama ve filtre ölçütlerine uygun şirket bulunamadı.</div>
          ) : (
            <div className="space-y-2 p-4">
              {filteredCompanies.map(company => (
                <button
                  key={company.companyId}
                  type="button"
                  onClick={() => selectCompany(company.companyId)}
                  className={`w-full rounded-xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                    company.companyId === selectedCompanyId
                      ? "border-cyan-400 bg-cyan-50/70 dark:border-cyan-500/50 dark:bg-cyan-500/10"
                      : "border-slate-200 hover:border-cyan-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-cyan-500/40 dark:hover:bg-slate-950/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{company.companyName}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{company.companySlug} · {company.companyCode}</div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${company.licenseActive ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>{company.licenseActive ? "Aktif" : "Pasif"}</span>
                      <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300">{company.packageLabel}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Şirket Detayı</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Paket, erişim kanalları ve kullanım sınırları</p>
          </div>

          {!selectedCompany ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
              <ShieldCheck className="h-7 w-7 text-slate-400 dark:text-slate-500" />
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">Bir şirket seçin</h3>
              <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">Lisans, kanal ve kullanım limitleri burada görüntülenecek.</p>
            </div>
          ) : (
            <div className="space-y-6 p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Genel</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div><p className="text-xs text-slate-500 dark:text-slate-400">Şirket</p><p className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedCompany.companyName}</p></div>
                  <div><p className="text-xs text-slate-500 dark:text-slate-400">Durum</p><p className="mt-1 font-semibold text-slate-900 dark:text-white">{selectedCompany.licenseActive ? "Aktif" : "Pasif"}</p></div>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Lisans</p>
                  <button type="button" onClick={() => openCompanyPanel("license")} className="text-xs font-semibold text-cyan-700 hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-cyan-300">Yönet</button>
                </div>
                <dl className="mt-3 grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div><dt className="text-xs text-slate-500 dark:text-slate-400">Paket</dt><dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{getPackageDisplayLabel(selectedCompany.package)}</dd></div>
                  <div><dt className="text-xs text-slate-500 dark:text-slate-400">Kullanıcı limiti</dt><dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedCompany.userLimit}</dd></div>
                  <div><dt className="text-xs text-slate-500 dark:text-slate-400">Şube limiti</dt><dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedCompany.branchLimit}</dd></div>
                  <div><dt className="text-xs text-slate-500 dark:text-slate-400">Başlangıç</dt><dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedCompany.licenseStartsAt}</dd></div>
                  <div><dt className="text-xs text-slate-500 dark:text-slate-400">Bitiş</dt><dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedCompany.licenseEndsAt || "—"}</dd></div>
                  <div><dt className="text-xs text-slate-500 dark:text-slate-400">Lisans durumu</dt><dd className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{selectedCompany.licenseActive ? "Aktif" : "Pasif"}</dd></div>
                </dl>
              </div>
              <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Kanallar</p>
                <div className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
                  {channelPlaceholders.map(channel => {
                    const Icon = channel.icon;
                    return (
                      <div key={channel.label} className="flex items-center justify-between py-3">
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"><Icon className="h-4 w-4 text-slate-400" />{channel.label}</span>
                        <span className="text-sm text-slate-400">—</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {draftPanel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-panel-title"
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-700 bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl dark:bg-slate-900"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-300">Frontend Taslağı</p>
                <h2 id="draft-panel-title" className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                  {draftPanel === "company" && "Yeni Şirket"}
                  {draftPanel === "license" && "Lisans Yönet"}
                  {draftPanel === "admin" && "Yönetici Ata"}
                </h2>
              </div>
              <button type="button" onClick={() => setDraftPanel(null)} aria-label="Pencereyi kapat" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>

            {draftPanel === "company" && (
              <form
                className="grid gap-4 p-5 sm:grid-cols-2"
                onSubmit={event => {
                  event.preventDefault();
                  setNotice("Canlı şirket oluşturma servisi henüz bağlı değildir. Bu işlem şu anda yalnız taslak olarak hazırlanabilir.");
                  setDraftPanel(null);
                }}
              >
                <label className="text-sm font-medium text-slate-700 sm:col-span-2 dark:text-slate-300">Şirket Adı<input required value={companyDraft.name} onChange={event => setCompanyDraft({...companyDraft, name: event.target.value})} className={fieldClassName} /></label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Şirket Kodu<input required value={companyDraft.code} onChange={event => setCompanyDraft({...companyDraft, code: event.target.value})} className={fieldClassName} /></label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Slug<input required value={companyDraft.slug} onChange={event => setCompanyDraft({...companyDraft, slug: event.target.value})} className={fieldClassName} /></label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2 dark:text-slate-300">Durum<select value={companyDraft.status} onChange={event => setCompanyDraft({...companyDraft, status: event.target.value})} className={fieldClassName}><option value="active">Aktif</option><option value="passive">Pasif</option></select></label>
                <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2 dark:border-slate-800"><button type="button" onClick={() => setDraftPanel(null)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:hover:bg-slate-800">İptal</button><button type="submit" className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">Taslağı Hazırla</button></div>
              </form>
            )}

            {draftPanel === "license" && selectedCompany && (
              <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); handlePreview(); }}>
                <div className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-950 sm:col-span-2 dark:bg-cyan-500/10 dark:text-cyan-100"><strong>{selectedCompany.companyName}</strong><p className="mt-1 text-xs opacity-75">Canlı sunucu yazımı kapalıdır.</p></div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Paket<select value={packageValue} onChange={event => setPackageValue(event.target.value as "ECO" | "STANDARD" | "PLUS")} className={fieldClassName}><option value="ECO">ECO</option><option value="STANDARD">STANDARD</option><option value="PLUS">PLUS</option></select></label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kullanıcı Limiti<input type="number" min={1} value={userLimit} onChange={event => setUserLimit(Number(event.target.value))} className={fieldClassName} /></label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Şube Limiti<input type="number" min={1} value={branchLimit} onChange={event => setBranchLimit(Number(event.target.value))} className={fieldClassName} /></label>
                <label className="flex items-end"><span className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">Lisans aktif<input type="checkbox" checked={licenseActive} onChange={event => setLicenseActive(event.target.checked)} className="h-4 w-4 accent-cyan-600" /></span></label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Başlangıç<input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} className={fieldClassName} /></label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bitiş<input type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)} className={fieldClassName} /></label>
                <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2 dark:border-slate-800"><button type="button" onClick={() => setDraftPanel(null)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:hover:bg-slate-800">İptal</button><button type="submit" className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">Taslağı Doğrula</button></div>
              </form>
            )}

            {draftPanel === "admin" && selectedCompany && (
              <form
                className="grid gap-4 p-5 sm:grid-cols-2"
                onSubmit={event => {
                  event.preventDefault();
                  setNotice("Canlı yönetici oluşturma servisi henüz bağlı değildir. Yönetici taslağı sunucuya kaydedilmedi.");
                  setDraftPanel(null);
                }}
              >
                <div className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-950 sm:col-span-2 dark:bg-cyan-500/10 dark:text-cyan-100"><strong>{selectedCompany.companyName}</strong><p className="mt-1 text-xs opacity-75">Bu form yalnız geçici frontend taslağıdır.</p></div>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2 dark:text-slate-300">Ad Soyad<input required value={adminDraft.fullName} onChange={event => setAdminDraft({...adminDraft, fullName: event.target.value})} className={fieldClassName} /></label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">E-posta<input required type="email" value={adminDraft.email} onChange={event => setAdminDraft({...adminDraft, email: event.target.value})} className={fieldClassName} /></label>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Telefon<input type="tel" value={adminDraft.phone} onChange={event => setAdminDraft({...adminDraft, phone: event.target.value})} className={fieldClassName} /></label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2 dark:text-slate-300">Rol<input value="Şirket Yöneticisi" readOnly className={`${fieldClassName} cursor-not-allowed bg-slate-100 dark:bg-slate-800`} /></label>
                <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2 dark:border-slate-800"><button type="button" onClick={() => setDraftPanel(null)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:hover:bg-slate-800">İptal</button><button type="submit" className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">Taslağı Hazırla</button></div>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
