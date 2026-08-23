"use client";

import {
  ImageIcon,
  Pencil,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  generateUUID,
  Product,
  useStore,
} from "@/store/useStore";
import { useSupplyChainStore } from "@/store/useSupplyChainStore";
import { useSalesStore } from "@/store/salesStore";
import { useErpRuntimeContext } from "@/lib/useErpRuntimeContext";
import {
  calculateCurrentStockAveragePurchasePrice,
  calculateSalePriceSummary,
} from "@/lib/stockPricingEngine";
import { ServiceRatePanel } from "@/components/stock/ServiceRatePanel";
import { BarcodeScannerButton } from "@/components/stock/BarcodeScannerButton";
import { useAuthStore } from "@/store/useAuthStore";
import {
  hasStockPermission,
} from "@/lib/stock/stockPermissionCatalog";
import {
  downloadStockExcelTemplate,
} from "@/lib/excelBridge/stockExcelTemplate";
import {
  downloadStockExcelData,
  type StockExcelValidatedPlan,
} from "@/lib/excelBridge/stockExcelV2Bridge";
import { StockExcelFinalModal } from "@/components/stock/StockExcelFinalModal";
import {
  validateStockV2BottomFinishOption,
} from "@/lib/stock/stockV2Policy";
import { StockV2BottomFinishPanel } from "@/components/stock/StockV2BottomFinishPanel";
import type {
  StockV2ProductFamily,
  StockV2ProductProfile,
} from "@/lib/stock/stockV2Contracts";
import {
  buildStockV2Profile,
  resolveStockV2FamilyRule,
  stockV2ScopeKey,
} from "@/lib/stock/stockV2Policy";
import { useStockV2Store } from "@/store/useStockV2Store";

type StockFormState = {
  id: string;
  stockCode: string;
  name: string;
  category: string;
  unit: string;
  brand: string;
  barcode1: string;
  barcode2: string;
  additionalDescription: string;
  generalDescription: string;
  imageUrl: string;
  purchasePrice1: string;
  purchasePrice2: string;
  purchasePrice3: string;
  purchasePrice4: string;
  salePrice1: string;
  salePrice2: string;
  salePrice3: string;
  salePrice4: string;
  purchaseVatRate: string;
  saleVatRate: string;
  defaultSupplierCustomerId: string;
  productKind: "PHYSICAL" | "SERVICE";
  requiresSewing: boolean;
  requiresInstallation: boolean;
  sewingServiceStockItemId: string;
  installationServiceStockItemId: string;
  targetProfitRate: string;
  overheadRate: string;
};

const emptyForm = (): StockFormState => ({
  id: generateUUID(),
  stockCode: "",
  name: "",
  category: "",
  unit: "Metre",
  brand: "",
  barcode1: "",
  barcode2: "",
  additionalDescription: "",
  generalDescription: "",
  imageUrl: "",
  purchasePrice1: "",
  purchasePrice2: "",
  purchasePrice3: "",
  purchasePrice4: "",
  salePrice1: "",
  salePrice2: "",
  salePrice3: "",
  salePrice4: "",
  purchaseVatRate: "",
  saleVatRate: "",
  defaultSupplierCustomerId: "",
  productKind: "PHYSICAL",
  requiresSewing: false,
  requiresInstallation: false,
  sewingServiceStockItemId: "",
  installationServiceStockItemId: "",
  targetProfitRate: "30",
  overheadRate: "100",
});

const numberValue = (
  value: string,
): number | undefined => {
  const normalized = value.replace(",", ".").trim();

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed)
    ? parsed
    : undefined;
};

const moneyLabel = (
  value?: number,
): string => {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(value)
  ) {
    return "-";
  }

  return value.toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY",
  });
};

function formFromProduct(
  product: Product,
): StockFormState {
  return {
    id: product.id,
    stockCode: product.stockCode,
    name: product.name,
    category: product.category || "",
    unit: product.unit || "Metre",
    brand: product.brand || "",
    barcode1: product.barcode1 || "",
    barcode2: product.barcode2 || "",
    additionalDescription:
      product.additionalDescription || "",
    generalDescription:
      product.generalDescription || "",
    imageUrl: product.imageUrl || "",
    purchasePrice1:
      product.purchasePrice1?.toString() || "",
    purchasePrice2:
      product.purchasePrice2?.toString() || "",
    purchasePrice3:
      product.purchasePrice3?.toString() || "",
    purchasePrice4:
      product.purchasePrice4?.toString() || "",
    salePrice1:
      product.salePrice1?.toString() ||
      product.cashPrice?.toString() ||
      "",
    salePrice2:
      product.salePrice2?.toString() ||
      product.installmentPrice?.toString() ||
      "",
    salePrice3:
      product.salePrice3?.toString() ||
      product.dealerPrice?.toString() ||
      "",
    salePrice4:
      product.salePrice4?.toString() || "",
    purchaseVatRate:
      product.purchaseVatRate?.toString() || "",
    saleVatRate:
      product.saleVatRate?.toString() || "",
    defaultSupplierCustomerId:
      product.defaultSupplierCustomerId || "",
    productKind:
      product.productKind || "PHYSICAL",
    requiresSewing:
      product.requiresSewing === true,
    requiresInstallation:
      product.requiresInstallation === true,
    sewingServiceStockItemId:
      product.sewingServiceStockItemId || "",
    installationServiceStockItemId:
      product.installationServiceStockItemId || "",
    targetProfitRate:
      product.targetProfitRate?.toString() || "30",
    overheadRate:
      product.overheadRate?.toString() || "100",
  };
}

export default function StockPage() {
  const { scope } = useErpRuntimeContext();
  const currentUser = useAuthStore(
    state => state.currentUser,
  );

  const canViewStock = currentUser
    ? hasStockPermission({
        role: currentUser.role,
        permissions: currentUser.permissions,
        requested: "stock.view",
      })
    : false;

  const canViewPhysical = currentUser
    ? hasStockPermission({
        role: currentUser.role,
        permissions: currentUser.permissions,
        requested: "stock.view_physical",
      })
    : false;

  const canViewService = currentUser
    ? hasStockPermission({
        role: currentUser.role,
        permissions: currentUser.permissions,
        requested: "stock.view_service",
      })
    : false;

  const canViewPurchasePrice = currentUser
    ? hasStockPermission({
        role: currentUser.role,
        permissions: currentUser.permissions,
        requested: "stock.view_purchase_price",
      })
    : false;

  const canViewSalePrice = currentUser
    ? hasStockPermission({
        role: currentUser.role,
        permissions: currentUser.permissions,
        requested: "stock.view_sale_price",
      })
    : false;

  const canCreateStock = currentUser
    ? hasStockPermission({
        role: currentUser.role,
        permissions: currentUser.permissions,
        requested: "stock.create",
      })
    : false;

  const canEditStock = currentUser
    ? hasStockPermission({
        role: currentUser.role,
        permissions: currentUser.permissions,
        requested: "stock.edit",
      })
    : false;

  const canExcelExport = currentUser
    ? hasStockPermission({
        role: currentUser.role,
        permissions: currentUser.permissions,
        requested: "stock.excel_export",
      })
    : false;

  const canExcelImport = currentUser
    ? hasStockPermission({
        role: currentUser.role,
        permissions: currentUser.permissions,
        requested: "stock.excel_import",
      })
    : false;
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const products = useStore(
    state => state.products,
  );
  const customers = useStore(
    state => state.customers,
  );
  const addProduct = useStore(
    state => state.addProduct,
  );
  const updateProduct = useStore(
    state => state.updateProduct,
  );
  const setProducts = useStore(
    state => state.setProducts,
  );

  const stockV2Profiles = useStockV2Store(
    state => state.profiles,
  );
  const upsertStockV2Profile = useStockV2Store(
    state => state.upsertProfile,
  );
  const removeStockV2Profile = useStockV2Store(
    state => state.removeProfile,
  );

  const lots = useSupplyChainStore(
    state => state.lots,
  );
  const centralSales = useSalesStore(
    state => state.sales,
  );
  const loadSales = useSalesStore(
    state => state.loadSales,
  );

  useEffect(() => {
    if (!scope) {
      return;
    }

    void loadSales(scope);
  }, [loadSales, scope]);

  const approvedSales = useMemo(
    () =>
      centralSales.filter(
        sale =>
          sale.isDeleted !== true &&
          (
            sale.status === "ONAYLANDI" ||
            sale.status === "SİPARİŞ" ||
            sale.status === "ÜRETİME_GÖNDERİLDİ" ||
            sale.status === "MONTAJA_GÖNDERİLDİ" ||
            sale.status === "TAMAMLANDI"
          ),
      ),
    [centralSales],
  );

  const priceIndicators = useMemo(() => {
    const result = new Map<
      string,
      {
        averagePurchase: number | null;
        lastPurchase: number | null;
        averageSale: number | null;
        lastSale: number | null;
      }
    >();

    for (const product of products) {
      const purchase =
        calculateCurrentStockAveragePurchasePrice(
          lots,
          product.id,
        );

      const saleInputs = approvedSales.flatMap(
        sale =>
          sale.items
            .filter(
              item =>
                item.stockItemId === product.id,
            )
            .map(item => ({
              stockItemId: product.id,
              unitPrice: item.unitPrice,
              quantity:
                Math.max(0, item.metricSize) *
                Math.max(0, item.quantity),
              occurredAt: sale.createdAt,
            })),
      );

      const sale =
        calculateSalePriceSummary(
          saleInputs,
          product.id,
        );

      result.set(product.id, {
        averagePurchase:
          purchase.averageUnitCost,
        lastPurchase:
          purchase.lastUnitCost,
        averageSale:
          sale.averageUnitPrice,
        lastSale:
          sale.lastUnitPrice,
      });
    }

    return result;
  }, [approvedSales, lots, products]);

  const [searchTerm, setSearchTerm] =
    useState("");
  const [listKind, setListKind] =
    useState<"PHYSICAL" | "SERVICE">(
      "PHYSICAL",
    );
  const [
    isExcelImportOpen,
    setIsExcelImportOpen,
  ] = useState(false);
  const [isFormOpen, setIsFormOpen] =
    useState(false);
  const [editingId, setEditingId] =
    useState<string | null>(null);
  const [form, setForm] =
    useState<StockFormState>(emptyForm);
  const [message, setMessage] =
    useState<string | null>(null);
  const [stockV2Family, setStockV2Family] =
    useState<StockV2ProductFamily>("OTHER");

  if (!mounted) {
    return (
      <div className="p-8 text-center">
        Yükleniyor...
      </div>
    );
  }

  const serviceProducts = products
    .filter(
      product =>
        product.productKind === "SERVICE",
    )
    .sort((left, right) =>
      left.name.localeCompare(
        right.name,
        "tr",
      ),
    );

  const supplierOptions = customers
    .filter(customer =>
      customer.cariType === "SUPPLIER" &&
      customer.isDeleted !== true &&
      customer.isArchived !== true
    )
    .sort((left, right) =>
      left.name.localeCompare(
        right.name,
        "tr",
      )
    );

  const filteredProducts = products.filter(
    product => {
      const effectiveKind =
        product.productKind === "SERVICE"
          ? "SERVICE"
          : "PHYSICAL";

      if (effectiveKind !== listKind) {
        return false;
      }

      if (
        effectiveKind === "PHYSICAL" &&
        !canViewPhysical
      ) {
        return false;
      }

      if (
        effectiveKind === "SERVICE" &&
        !canViewService
      ) {
        return false;
      }

      const query =
        searchTerm.trim().toLocaleLowerCase("tr");

      if (!query) {
        return true;
      }

      return [
        product.stockCode,
        product.name,
        product.category,
        product.brand,
        product.barcode1,
        product.barcode2,
      ]
        .filter(Boolean)
        .some(value =>
          String(value)
            .toLocaleLowerCase("tr")
            .includes(query)
        );
    },
  );
  const handleBarcodeLookup = (
    barcode: string,
  ) => {
    const normalized =
      barcode.trim();

    const matches = products.filter(
      product =>
        product.barcode1?.trim() ===
          normalized ||
        product.barcode2?.trim() ===
          normalized,
    );

    if (matches.length === 1) {
      setSearchTerm(normalized);
      openEdit(matches[0]);
      return;
    }

    if (matches.length === 0) {
      window.alert(
        `Barkodla eşleşen stok bulunamadı: ${normalized}`,
      );
      return;
    }

    window.alert(
      "Aynı barkod birden fazla stok kartında kayıtlı. Otomatik açma yapılmadı.",
    );
  };

  const findStockV2Profile = (
    productId: string,
  ): StockV2ProductProfile | undefined => {
    if (!scope) {
      return undefined;
    }

    const expectedScopeKey =
      stockV2ScopeKey(scope);

    return stockV2Profiles.find(
      profile =>
        profile.productId === productId &&
        stockV2ScopeKey(profile.scope) ===
          expectedScopeKey,
    );
  };

  const applyStockV2Family = (
    family: StockV2ProductFamily,
  ) => {
    setStockV2Family(family);

    if (form.productKind !== "PHYSICAL") {
      return;
    }

    const rule =
      resolveStockV2FamilyRule(family);

    if (rule.canonicalUnit === "mt") {
      setField("unit", "Metre");
    } else if (rule.canonicalUnit === "m2") {
      setField("unit", "m²");
    } else if (rule.canonicalUnit === "adet") {
      setField("unit", "Adet");
    }
  };

  const openNew = () => {
    if (!canCreateStock) {
      window.alert(
        "Yeni stok kartı açma yetkiniz yok.",
      );
      return;
    }

    setEditingId(null);
    setForm(emptyForm());
    setStockV2Family("OTHER");
    setMessage(null);
    setIsFormOpen(true);
  };

  const openEdit = (product: Product) => {
    if (!canEditStock) {
      window.alert(
        "Stok kartı düzenleme yetkiniz yok.",
      );
      return;
    }

    const profile =
      findStockV2Profile(product.id);

    setEditingId(product.id);
    setForm(formFromProduct(product));
    setStockV2Family(
      profile?.family ?? "OTHER",
    );
    setMessage(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setMessage(null);
  };

  const handleStockExcelExport = () => {
    if (!canExcelExport) {
      window.alert(
        "Excel dışa aktarma yetkiniz yok.",
      );
      return;
    }

    const stockV2State =
      useStockV2Store.getState();

    downloadStockExcelData({
      products,
      suppliers: supplierOptions.map(
        supplier => ({
          id: supplier.id,
          name: supplier.name,
        }),
      ),
      profiles:
        stockV2State.profiles,
      finishes:
        stockV2State.bottomFinishOptions,
      includePurchasePrices:
        canViewPurchasePrice,
      includeSalePrices:
        canViewSalePrice,
      canViewPhysical,
      canViewService,
    });
  };

  const handleStockExcelCommit = async (
    plan: StockExcelValidatedPlan,
  ) => {
    if (!canExcelImport) {
      throw new Error(
        "Excel içe aktarma yetkiniz yok.",
      );
    }

    if (!scope) {
      throw new Error(
        "Aktif şirket / şube / dönem kapsamı bulunamadı.",
      );
    }

    if (
      plan.errorCount > 0 ||
      plan.cards.length === 0
    ) {
      throw new Error(
        "Dosya temiz değil. Toplu kayıt yapılmadı.",
      );
    }

    const latestProducts =
      useStore.getState().products;
    const latestCodes =
      new Set(
        latestProducts.map(product =>
          product.stockCode
            .trim()
            .toLocaleUpperCase("tr-TR"),
        ),
      );
    const latestBarcodes =
      new Set(
        latestProducts
          .flatMap(product => [
            product.barcode1,
            product.barcode2,
          ])
          .filter(Boolean)
          .map(value =>
            String(value)
              .trim()
              .toLocaleUpperCase("tr-TR"),
          ),
      );

    for (const card of plan.cards) {
      const code =
        card.stockCode
          .trim()
          .toLocaleUpperCase("tr-TR");

      if (latestCodes.has(code)) {
        throw new Error(
          `Stok kodu artık sistemde mevcut: ${card.stockCode}`,
        );
      }

      for (const barcode of [
        card.barcode1,
        card.barcode2,
      ]) {
        if (
          barcode &&
          latestBarcodes.has(
            barcode
              .trim()
              .toLocaleUpperCase("tr-TR"),
          )
        ) {
          throw new Error(
            `Barkod artık sistemde mevcut: ${barcode}`,
          );
        }
      }
    }

    const now =
      new Date().toISOString();
    const idByStockCode =
      new Map<string, string>();

    const importedProducts:
      Product[] = plan.cards.map(card => {
        const id = generateUUID();
        idByStockCode.set(
          card.stockCode
            .trim()
            .toLocaleUpperCase("tr-TR"),
          id,
        );

        const salePrice1 =
          card.salePrice1 ?? 0;
        const salePrice2 =
          card.salePrice2 ??
          salePrice1;
        const salePrice3 =
          card.salePrice3 ??
          salePrice1;

        return {
          id,
          stockCode:
            card.stockCode.trim(),
          name: card.name.trim(),
          category:
            card.category?.trim() ?? "",
          unit:
            card.unit.trim() ||
            (card.productKind ===
            "SERVICE"
              ? "Hizmet"
              : "Metre"),
          cashPrice: salePrice1,
          installmentPrice:
            salePrice2,
          dealerPrice: salePrice3,
          brand:
            card.brand?.trim() ||
            undefined,
          barcode1:
            card.barcode1?.trim() ||
            undefined,
          barcode2:
            card.barcode2?.trim() ||
            undefined,
          additionalDescription:
            card.extraDescription
              ?.trim() || undefined,
          generalDescription:
            card.description?.trim() ||
            undefined,
          purchasePrice1:
            card.purchasePrice1,
          purchasePrice2:
            card.purchasePrice2,
          purchasePrice3:
            card.purchasePrice3,
          purchasePrice4:
            card.purchasePrice4,
          salePrice1:
            card.salePrice1,
          salePrice2:
            card.salePrice2,
          salePrice3:
            card.salePrice3,
          salePrice4:
            card.salePrice4,
          purchaseVatRate:
            card.purchaseVatRate,
          saleVatRate:
            card.saleVatRate,
          defaultSupplierCustomerId:
            card.productKind ===
            "PHYSICAL"
              ? card.supplierId
              : undefined,
          productKind:
            card.productKind,
          requiresSewing:
            card.productKind ===
              "PHYSICAL" &&
            card.requiresSewing,
          requiresInstallation:
            card.productKind ===
              "PHYSICAL" &&
            card.requiresInstallation,
        };
      });

    const importedProfiles =
      plan.cards
        .filter(
          card =>
            card.productKind ===
              "PHYSICAL" &&
            card.family,
        )
        .map(card => {
          const productId =
            idByStockCode.get(
              card.stockCode
                .trim()
                .toLocaleUpperCase(
                  "tr-TR",
                ),
            );

          if (!productId || !card.family) {
            throw new Error(
              `Ürün ailesi kimliği oluşturulamadı: ${card.stockCode}`,
            );
          }

          return buildStockV2Profile({
            id: generateUUID(),
            productId,
            scope,
            family: card.family,
            createdAt: now,
            updatedAt: now,
          });
        });

    const profileByProductId =
      new Map(
        importedProfiles.map(
          profile => [
            profile.productId,
            profile,
          ],
        ),
      );

    const importedFinishes =
      plan.finishes.map(finish => {
        const productId =
          idByStockCode.get(
            finish.stockCode
              .trim()
              .toLocaleUpperCase(
                "tr-TR",
              ),
          );

        if (!productId) {
          throw new Error(
            `Etek seçeneği stok kartına bağlanamadı: ${finish.stockCode}`,
          );
        }

        const profile =
          profileByProductId.get(
            productId,
          );

        if (!profile) {
          throw new Error(
            `Etek seçeneği için ürün profili bulunamadı: ${finish.stockCode}`,
          );
        }

        const option = {
          id: generateUUID(),
          productId,
          scope,
          kind: finish.kind,
          code:
            finish.code.trim(),
          name:
            finish.name.trim(),
          pricingBasis:
            finish.pricingBasis,
          purchaseUnitPrice:
            finish.purchaseUnitPrice,
          saleUnitPrice:
            finish.saleUnitPrice,
          purchaseVatRate:
            finish.purchaseVatRate,
          saleVatRate:
            finish.saleVatRate,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };

        validateStockV2BottomFinishOption(
          option,
          profile,
        );

        return option;
      });

    const stockV2Snapshot =
      useStockV2Store.getState();
    const previousProducts =
      latestProducts;

    try {
      setProducts([
        ...latestProducts,
        ...importedProducts,
      ]);

      useStockV2Store.setState({
        profiles: [
          ...stockV2Snapshot.profiles,
          ...importedProfiles,
        ],
        bottomFinishOptions: [
          ...stockV2Snapshot.bottomFinishOptions,
          ...importedFinishes,
        ],
      });
    } catch (error) {
      setProducts(previousProducts);
      useStockV2Store.setState({
        profiles:
          stockV2Snapshot.profiles,
        bottomFinishOptions:
          stockV2Snapshot.bottomFinishOptions,
      });
      throw error;
    }

    setMessage(
      `${importedProducts.length} stok/hizmet kartı ve ${importedFinishes.length} etek seçeneği toplu açıldı.`,
    );
  };

  const setField = <
    K extends keyof StockFormState,
  >(
    field: K,
    value: StockFormState[K],
  ) => {
    setForm(current => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = () => {
    const mutationAllowed =
      editingId ? canEditStock : canCreateStock;

    if (!mutationAllowed) {
      setMessage(
        editingId
          ? "Stok kartı düzenleme yetkiniz yok."
          : "Yeni stok kartı açma yetkiniz yok.",
      );
      return;
    }

    const stockCode = form.stockCode.trim();
    const name = form.name.trim();

    if (!scope) {
      setMessage(
        "Aktif şirket / şube / dönem kapsamı bulunamadı.",
      );
      return;
    }

    if (!stockCode || !name) {
      setMessage(
        "Stok kodu ve stok adı zorunludur.",
      );
      return;
    }

    const duplicate = products.some(
      product =>
        product.id !== form.id &&
        product.stockCode
          .trim()
          .toLocaleUpperCase("tr") ===
          stockCode.toLocaleUpperCase("tr"),
    );

    if (duplicate) {
      setMessage(
        "Bu stok kodu zaten kullanılıyor.",
      );
      return;
    }

    const salePrice1 =
      numberValue(form.salePrice1) ?? 0;
    const salePrice2 =
      numberValue(form.salePrice2) ??
      salePrice1;
    const salePrice3 =
      numberValue(form.salePrice3) ??
      salePrice1;

    const stockV2Rule =
      resolveStockV2FamilyRule(
        stockV2Family,
      );

    const canonicalLegacyUnit =
      form.productKind !== "PHYSICAL"
        ? form.unit.trim() || "Hizmet"
        : stockV2Rule.canonicalUnit === "mt"
          ? "Metre"
          : stockV2Rule.canonicalUnit === "m2"
            ? "m²"
            : stockV2Rule.canonicalUnit === "adet"
              ? "Adet"
              : form.unit.trim() || "Metre";

    const existingStockV2Profile =
      findStockV2Profile(form.id);
    const now = new Date().toISOString();

    const nextStockV2Profile =
      form.productKind === "PHYSICAL"
        ? buildStockV2Profile({
            id:
              existingStockV2Profile?.id ??
              generateUUID(),
            productId: form.id,
            scope,
            family: stockV2Family,
            createdAt:
              existingStockV2Profile?.createdAt ??
              now,
            updatedAt: now,
          })
        : null;

    const productData: Product = {
      id: form.id,
      stockCode,
      name,
      category: form.category.trim(),
      unit: canonicalLegacyUnit,

      // Legacy fields remain compatible.
      cashPrice: salePrice1,
      installmentPrice: salePrice2,
      dealerPrice: salePrice3,

      brand: form.brand.trim() || undefined,
      barcode1:
        form.barcode1.trim() || undefined,
      barcode2:
        form.barcode2.trim() || undefined,
      additionalDescription:
        form.additionalDescription.trim() ||
        undefined,
      generalDescription:
        form.generalDescription.trim() ||
        undefined,
      imageUrl:
        form.imageUrl.trim() || undefined,

      purchasePrice1:
        numberValue(form.purchasePrice1),
      purchasePrice2:
        numberValue(form.purchasePrice2),
      purchasePrice3:
        numberValue(form.purchasePrice3),
      purchasePrice4:
        numberValue(form.purchasePrice4),

      salePrice1:
        numberValue(form.salePrice1),
      salePrice2:
        numberValue(form.salePrice2),
      salePrice3:
        numberValue(form.salePrice3),
      salePrice4:
        numberValue(form.salePrice4),

      purchaseVatRate:
        numberValue(form.purchaseVatRate),
      saleVatRate:
        numberValue(form.saleVatRate),

      defaultSupplierCustomerId:
        form.defaultSupplierCustomerId ||
        undefined,

      productKind: form.productKind,
      requiresSewing:
        form.productKind === "PHYSICAL" &&
        form.requiresSewing,
      requiresInstallation:
        form.productKind === "PHYSICAL" &&
        form.requiresInstallation,

      sewingServiceStockItemId:
        form.productKind === "PHYSICAL" &&
        form.requiresSewing
          ? form.sewingServiceStockItemId ||
            undefined
          : undefined,

      installationServiceStockItemId:
        form.productKind === "PHYSICAL" &&
        form.requiresInstallation
          ? form.installationServiceStockItemId ||
            undefined
          : undefined,

      targetProfitRate:
        numberValue(form.targetProfitRate),
      overheadRate:
        numberValue(form.overheadRate),

      // System calculated fields are deliberately
      // not edited from the master-card form.
      currentStockAveragePurchasePrice:
        editingId
          ? (priceIndicators.get(editingId)?.averagePurchase ?? undefined)
          : undefined,
      currentStockAverageSalePrice:
        editingId
          ? (priceIndicators.get(editingId)?.averageSale ?? undefined)
          : undefined,
      lastPurchasePrice:
        editingId
          ? (priceIndicators.get(editingId)?.lastPurchase ?? undefined)
          : undefined,
      lastSalePrice:
        editingId
          ? (priceIndicators.get(editingId)?.lastSale ?? undefined)
          : undefined,
      suggestedSalePrice:
        editingId
          ? products.find(
              product =>
                product.id === editingId,
            )?.suggestedSalePrice
          : undefined,
    };

    if (editingId) {
      updateProduct(
        editingId,
        productData,
      );
    } else {
      addProduct(productData);
    }

    if (nextStockV2Profile) {
      upsertStockV2Profile(
        nextStockV2Profile,
      );
    } else {
      removeStockV2Profile(
        form.id,
        scope,
      );
    }

    setIsFormOpen(false);
    setEditingId(null);
    setMessage(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold heading-title">
            Stok Yönetimi
          </h1>
          <p className="text-sm heading-subtitle">
            Stok kartları, ticari fiyatlar ve
            ürün davranışlarını yönetin.
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          disabled={!canCreateStock}
          title={
            canCreateStock
              ? "Yeni stok kartı aç"
              : "Yeni stok kartı açma yetkiniz yok"
          }
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Yeni Stok Kartı
        </button>
      </div>

            {!canViewStock ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
          Stok modülünü görüntüleme yetkiniz yok.
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            <button
              type="button"
              disabled={!canViewPhysical}
              onClick={() => setListKind("PHYSICAL")}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                listKind === "PHYSICAL"
                  ? "bg-white shadow-sm dark:bg-gray-950"
                  : "text-gray-500"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Fiziksel Ürünler
            </button>
            <button
              type="button"
              disabled={!canViewService}
              onClick={() => setListKind("SERVICE")}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${
                listKind === "SERVICE"
                  ? "bg-white shadow-sm dark:bg-gray-950"
                  : "text-gray-500"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Hizmet Kartları
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canExcelExport}
              onClick={() =>
                downloadStockExcelTemplate()
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Excel Şablonu
            </button>

            <button
              type="button"
              disabled={!canExcelImport}
              onClick={() =>
                setIsExcelImportOpen(true)
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Excel'den İçeri Aktar
            </button>

            <button
              type="button"
              disabled={!canExcelExport}
              onClick={
                handleStockExcelExport
              }
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Excel'e Aktar
            </button>
          </div>
        </div>
      )}
<div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 p-4 dark:border-gray-800">
          <div className="flex max-w-xl items-center gap-2">
            <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={event =>
                setSearchTerm(event.target.value)
              }
              placeholder="Stok kodu, ürün, marka veya barkod ara..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />
          </div>
            <BarcodeScannerButton
              onDetected={
                handleBarcodeLookup
              }
              title="Kamera ile barkod okut"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-950/50 dark:text-gray-400">
              <tr>
                <th className="p-4">Ürün</th>
                <th className="p-4">Stok Kodu</th>
                <th className="p-4">Stok Adı</th>
                <th className="p-4">Grup</th>
                <th className="p-4">Marka</th>
                {canViewPurchasePrice && (
<th className="p-4 text-right">
                  Ort. Alış
                </th>
)}
                {canViewPurchasePrice && (
<th className="p-4 text-right">
                  Son Alış
                </th>
)}
                {canViewSalePrice && (
<th className="p-4 text-right">
                  Ort. Satış
                </th>
)}
                {canViewSalePrice && (
<th className="p-4 text-right">
                  Önerilen Satış
                </th>
)}
                <th className="p-4 text-center">
                  İşlem
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map(product => (
                <tr
                  key={product.id}
                  className="border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                >
                  <td className="p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded border border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                  </td>

                  <td className="p-4 font-medium text-gray-900 dark:text-white">
                    {product.stockCode}
                  </td>

                  <td className="p-4 text-gray-900 dark:text-white">
                    <div className="font-medium">
                      {product.name}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {product.productKind === "SERVICE"
                        ? "Hizmet"
                        : product.unit}
                    </div>
                  </td>

                  <td className="p-4 text-gray-500 dark:text-gray-400">
                    {product.category || "-"}
                  </td>

                  <td className="p-4 text-gray-500 dark:text-gray-400">
                    {product.brand || "-"}
                  </td>

                  {canViewPurchasePrice && (
<td className="p-4 text-right font-medium text-gray-900 dark:text-white">
                    {moneyLabel(priceIndicators.get(product.id)?.averagePurchase ?? undefined)}
                  </td>
)}

                  {canViewPurchasePrice && (
<td className="p-4 text-right text-gray-600 dark:text-gray-300">
                    {moneyLabel(priceIndicators.get(product.id)?.lastPurchase ?? undefined)}
                  </td>
)}

                  {canViewSalePrice && (
<td className="p-4 text-right text-gray-600 dark:text-gray-300">
                    {moneyLabel(priceIndicators.get(product.id)?.averageSale ?? undefined)}
                  </td>
)}

                  {canViewSalePrice && (
<td className="p-4 text-right font-semibold text-blue-600 dark:text-blue-400">
                    {moneyLabel(
                      product.suggestedSalePrice,
                    )}
                  </td>
)}

                  <td className="p-4 text-center">
                    <button
                      type="button"
                      onClick={() => openEdit(product)}
                      disabled={!canEditStock}
                      title={
                        canEditStock
                          ? "Stok kartını düzenle"
                          : "Stok kartı düzenleme yetkiniz yok"
                      }
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-blue-400 dark:hover:bg-blue-900/20"
                    >
                      <Pencil className="h-4 w-4" />
                      Düzenle
                    </button>
                  </td>
                </tr>
              ))}

              {filteredProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={6 + (canViewPurchasePrice ? 2 : 0) + (canViewSalePrice ? 2 : 0)}
                    className="p-8 text-center text-gray-500"
                  >
                    Stok kartı bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StockExcelFinalModal
        isOpen={isExcelImportOpen}
        onClose={() =>
          setIsExcelImportOpen(false)
        }
        existingProducts={products}
        suppliers={supplierOptions.map(
          supplier => ({
            id: supplier.id,
            name: supplier.name,
          }),
        )}
        onCommit={handleStockExcelCommit}
      />

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center">
          <div className="my-4 w-full max-w-6xl rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingId
                    ? "Stok Kartı Düzenle"
                    : "Yeni Stok Kartı"}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Kart bilgileri referans ve
                  tanım alanlarıdır. Ortalama/son
                  fiyatlar hareketlerden hesaplanır.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[76vh] space-y-6 overflow-y-auto p-5">
              {message && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  {message}
                </div>
              )}

              <section
                data-stock-v2-section="product"
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <h3 className="mb-1 text-base font-bold text-gray-900 dark:text-white">
                  1. ÜRÜN
                </h3>
                <p className="mb-4 text-xs text-gray-500">
                  Bu ne? Ürünün temel kimliği, ailesi ve çalışma birimi.
                </p>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Stok Kodu *
                    <input
                      value={form.stockCode}
                      onChange={event =>
                        setField(
                          "stockCode",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>

                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 md:col-span-2">
                    Stok Adı *
                    <input
                      value={form.name}
                      onChange={event =>
                        setField(
                          "name",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>

                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Tür
                    <select
                      value={form.productKind}
                      onChange={event =>
                        setField(
                          "productKind",
                          event.target.value as
                            | "PHYSICAL"
                            | "SERVICE",
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="PHYSICAL">
                        Fiziksel Ürün
                      </option>
                      <option value="SERVICE">
                        Hizmet
                      </option>
                    </select>
                  </label>

                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Grup / Kategori
                    <input
                      value={form.category}
                      onChange={event =>
                        setField(
                          "category",
                          event.target.value,
                        )
                      }
                      placeholder="Örn. 0001 PERDE / Tül"
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>

                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Marka
                    <input
                      value={form.brand}
                      onChange={event =>
                        setField(
                          "brand",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>

                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Birim
                    <select
                      value={form.unit}
                      onChange={event =>
                        setField(
                          "unit",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="Metre">
                        Metre
                      </option>
                      <option value="m²">m²</option>
                      <option value="Adet">
                        Adet
                      </option>
                      <option value="Takım">
                        Takım
                      </option>
                      <option value="Hizmet">
                        Hizmet
                      </option>
                    </select>
                  </label>

                  {form.productKind === "PHYSICAL" && (
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      Ürün Ailesi
                      <select
                        value={stockV2Family}
                        onChange={event =>
                          applyStockV2Family(
                            event.target.value as StockV2ProductFamily,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      >
                        <option value="TUL">Tül</option>
                        <option value="FON">Fon</option>
                        <option value="GUNESLIK">Güneşlik</option>
                        <option value="STOR">Stor</option>
                        <option value="ZEBRA">Zebra</option>
                        <option value="JALUZI">Jaluzi</option>
                        <option value="PLICELL">Pliseli / Plicell</option>
                        <option value="DIKEY_TUL">Dikey Tül</option>
                        <option value="DIKEY_STOR">Dikey Stor</option>
                        <option value="CEYIZLIK">Çeyizlik</option>
                        <option value="AKSESUAR">Aksesuar</option>
                        <option value="RUSTIK">Rustik</option>
                        <option value="OTHER">Diğer</option>
                      </select>
                    </label>
                  )}



                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Barkod 1
                    <input
                      value={form.barcode1}
                      onChange={event =>
                        setField(
                          "barcode1",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>

                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Barkod 2
                    <input
                      value={form.barcode2}
                      onChange={event =>
                        setField(
                          "barcode2",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                </div>
              </section>

              {canViewPurchasePrice && (
<section
                data-stock-v2-section="price-supplier"
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <h3 className="mb-1 text-base font-bold text-gray-900 dark:text-white">
                  2. FİYAT & TEDARİK
                </h3>
                <p className="mb-4 text-xs text-gray-500">
                  Kimden ve kaça alıyoruz? Satış, maliyet ve kâr referansları.
                </p>

                <div className="mb-4 grid gap-4 md:grid-cols-3">
<label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Tedarikçi
                    <select
                      value={
                        form.defaultSupplierCustomerId
                      }
                      onChange={event =>
                        setField(
                          "defaultSupplierCustomerId",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="">
                        Bağlantı yok
                      </option>
                      {supplierOptions.map(
                        supplier => (
                          <option
                            key={supplier.id}
                            value={supplier.id}
                          >
                            {supplier.name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
<label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Hedef Kâr %
                    <input
                      inputMode="decimal"
                      value={form.targetProfitRate}
                      onChange={event =>
                        setField(
                          "targetProfitRate",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
<label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Genel Gider Oranı %
                    <input
                      inputMode="decimal"
                      value={form.overheadRate}
                      onChange={event =>
                        setField(
                          "overheadRate",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                </div>

                <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Alış Referans Fiyatları
                </h4>

                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                  {(
                    [
                      "purchasePrice1",
                      "purchasePrice2",
                      "purchasePrice3",
                      "purchasePrice4",
                    ] as const
                  ).map((field, index) => (
                    <label
                      key={field}
                      className="text-xs font-medium text-gray-600 dark:text-gray-300"
                    >
                      Alış Fiyatı {index + 1}
                      <input
                        inputMode="decimal"
                        value={form[field]}
                        onChange={event =>
                          setField(
                            field,
                            event.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      />
                    </label>
                  ))}

                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Alış KDV %
                    <input
                      inputMode="decimal"
                      placeholder="Boş bırakılabilir"
                      value={form.purchaseVatRate}
                      onChange={event =>
                        setField(
                          "purchaseVatRate",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                </div>
              </section>
)}

              {canViewSalePrice && (
<section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Satış Referans Fiyatları
                </h4>

                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                  {(
                    [
                      "salePrice1",
                      "salePrice2",
                      "salePrice3",
                      "salePrice4",
                    ] as const
                  ).map((field, index) => (
                    <label
                      key={field}
                      className="text-xs font-medium text-gray-600 dark:text-gray-300"
                    >
                      Satış Fiyatı {index + 1}
                      <input
                        inputMode="decimal"
                        value={form[field]}
                        onChange={event =>
                          setField(
                            field,
                            event.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      />
                    </label>
                  ))}

                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Satış KDV %
                    <input
                      inputMode="decimal"
                      value={form.saleVatRate}
                      onChange={event =>
                        setField(
                          "saleVatRate",
                          event.target.value,
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />
                  </label>
                </div>
              </section>
)}

              {(canViewPurchasePrice && canViewSalePrice) && (
<section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Sistem Fiyat Göstergeleri
                </h4>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    [
                      "Mevcut Stok Ortalama Alış",
                      editingId
                        ? (priceIndicators.get(editingId)?.averagePurchase ?? undefined)
                        : undefined,
                    ],
                    [
                      "Son Alış Fiyatı",
                      editingId
                        ? (priceIndicators.get(editingId)?.lastPurchase ?? undefined)
                        : undefined,
                    ],
                    [
                      "Mevcut Stok Ortalama Satış",
                      editingId
                        ? (priceIndicators.get(editingId)?.averageSale ?? undefined)
                        : undefined,
                    ],
                    [
                      "Son Satış Fiyatı",
                      editingId
                        ? (priceIndicators.get(editingId)?.lastSale ?? undefined)
                        : undefined,
                    ],
                    [
                      "Önerilen Satış Fiyatı",
                      editingId
                        ? products.find(
                            product =>
                              product.id === editingId,
                          )?.suggestedSalePrice
                        : undefined,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/50"
                    >
                      <div className="text-[11px] font-medium text-gray-500">
                        {label}
                      </div>
                      <div className="mt-1 text-base font-bold text-gray-900 dark:text-white">
                        {moneyLabel(
                          typeof value ===
                            "number"
                            ? value
                            : undefined,
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
)}

              <section
                data-stock-v2-section="options"
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <h3 className="mb-1 text-base font-bold text-gray-900 dark:text-white">
                  3. ÜRÜN SEÇENEKLERİ
                </h3>
                <p className="mb-4 text-xs text-gray-500">
                  Özel seçeneği var mı? Dikim, montaj ve uygun üründe Etek Modeli / Etek Lazer.
                </p>

                <div className="grid gap-4 md:grid-cols-4">




                  {form.productKind ===
                    "PHYSICAL" && (
                    <>
                      <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={
                            form.requiresSewing
                          }
                          onChange={event =>
                            setField(
                              "requiresSewing",
                              event.target.checked,
                            )
                          }
                        />
                        Dikim gerekir
                      </label>

                      <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={
                            form.requiresInstallation
                          }
                          onChange={event =>
                            setField(
                              "requiresInstallation",
                              event.target.checked,
                            )
                          }
                        />
                        Montaj gerekir
                      </label>
                    </>
                  )}
                </div>

                {form.productKind === "PHYSICAL" && (
                  <>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {form.requiresSewing && (
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        Dikim Hizmet Kartı
                        <select
                          value={
                            form.sewingServiceStockItemId
                          }
                          onChange={event =>
                            setField(
                              "sewingServiceStockItemId",
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        >
                          <option value="">
                            Hizmet seçiniz
                          </option>
                          {serviceProducts.map(
                            service => (
                              <option
                                key={service.id}
                                value={service.id}
                              >
                                {service.stockCode} — {service.name}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    )}

                    {form.requiresInstallation && (
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        Montaj Hizmet Kartı
                        <select
                          value={
                            form.installationServiceStockItemId
                          }
                          onChange={event =>
                            setField(
                              "installationServiceStockItemId",
                              event.target.value,
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        >
                          <option value="">
                            Hizmet seçiniz
                          </option>
                          {serviceProducts.map(
                            service => (
                              <option
                                key={service.id}
                                value={service.id}
                              >
                                {service.stockCode} — {service.name}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    )}
                  </div>

                  <StockV2BottomFinishPanel
                    productId={form.id}
                    profile={
                      editingId
                        ? findStockV2Profile(form.id)
                        : undefined
                    }
                    isSaved={Boolean(editingId)}
                  />
                  </>
                )}
              </section>

              {form.productKind === "SERVICE" && (
                editingId ? (
                  <ServiceRatePanel
                    serviceStockItemId={form.id}
                    serviceName={form.name || "Hizmet"}
                  />
                ) : (
                  <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <div className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Sağlayıcı tarifesi girmek için önce hizmet stok kartını kaydedin.
                    </div>
                  </section>
                )
              )}

              <section className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Ek Açıklama
                  <textarea
                    value={
                      form.additionalDescription
                    }
                    onChange={event =>
                      setField(
                        "additionalDescription",
                        event.target.value,
                      )
                    }
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>

                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Ürün Genel Açıklaması
                  <textarea
                    value={
                      form.generalDescription
                    }
                    onChange={event =>
                      setField(
                        "generalDescription",
                        event.target.value,
                      )
                    }
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
              </section>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                <Save className="h-4 w-4" />
                Stok Kartını Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}