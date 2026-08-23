import * as XLSX from "xlsx";

import { parseExcelYesNo } from "./profiles/stockExcelProfile";
import {
  STOCK_BOTTOM_FINISH_SHEET_NAME,
  STOCK_CARDS_SHEET_NAME,
  STOCK_BOTTOM_FINISH_TEMPLATE_HEADERS,
  STOCK_CARD_TEMPLATE_HEADERS,
} from "./stockExcelTemplate";
import type {
  StockV2BottomFinishKind,
  StockV2PricingBasis,
  StockV2ProductFamily,
} from "@/lib/stock/stockV2Contracts";
import {
  resolveStockV2FamilyRule,
} from "@/lib/stock/stockV2Policy";

export interface StockExcelExistingProduct {
  id: string;
  stockCode: string;
  productKind?: "PHYSICAL" | "SERVICE";
  barcode1?: string;
  barcode2?: string;
}

export interface StockExcelSupplier {
  id: string;
  name: string;
}

export interface StockExcelPreparedCard {
  stockCode: string;
  name: string;
  productKind: "PHYSICAL" | "SERVICE";
  category?: string;
  brand?: string;
  family?: StockV2ProductFamily;
  unit: string;
  supplierId?: string;
  supplierName?: string;
  barcode1?: string;
  barcode2?: string;
  purchasePrice1?: number;
  purchasePrice2?: number;
  purchasePrice3?: number;
  purchasePrice4?: number;
  purchaseVatRate?: number;
  salePrice1?: number;
  salePrice2?: number;
  salePrice3?: number;
  salePrice4?: number;
  saleVatRate?: number;
  requiresSewing: boolean;
  requiresInstallation: boolean;
  extraDescription?: string;
  description?: string;
}

export interface StockExcelPreparedFinish {
  stockCode: string;
  kind: StockV2BottomFinishKind;
  code: string;
  name: string;
  pricingBasis: StockV2PricingBasis;
  purchaseUnitPrice?: number;
  purchaseVatRate?: number;
  saleUnitPrice?: number;
  saleVatRate?: number;
}

export interface StockExcelValidationRow {
  sheet: string;
  rowNumber: number;
  primary: string;
  status: "OK" | "ERROR";
  errors: string[];
}

export interface StockExcelValidatedPlan {
  cards: StockExcelPreparedCard[];
  finishes: StockExcelPreparedFinish[];
  rows: StockExcelValidationRow[];
  errorCount: number;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function key(value: unknown): string {
  return text(value)
    .toLocaleUpperCase("tr-TR");
}

function normalizedName(value: unknown): string {
  return text(value)
    .toLocaleLowerCase("tr-TR");
}

function optionalNumber(
  value: unknown,
  label: string,
  errors: string[],
): number | undefined {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  const normalized =
    typeof value === "string"
      ? value
          .trim()
          .replace(/\s+/g, "")
          .replace(",", ".")
      : value;

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    errors.push(`${label}: sayısal değer bekleniyor`);
    return undefined;
  }

  if (parsed < 0) {
    errors.push(`${label}: negatif olamaz`);
    return undefined;
  }

  return parsed;
}

function optionalVat(
  value: unknown,
  label: string,
  errors: string[],
): number | undefined {
  const parsed = optionalNumber(
    value,
    label,
    errors,
  );

  if (parsed === undefined) {
    return undefined;
  }

  if (parsed > 100) {
    errors.push(`${label}: 0-100 arasında olmalıdır`);
    return undefined;
  }

  return parsed;
}

function parseKind(
  value: unknown,
  errors: string[],
): "PHYSICAL" | "SERVICE" | undefined {
  const normalized =
    normalizedName(value);

  if (
    normalized === "fiziksel ürün" ||
    normalized === "fiziksel urun" ||
    normalized === "physical"
  ) {
    return "PHYSICAL";
  }

  if (
    normalized === "hizmet" ||
    normalized === "service"
  ) {
    return "SERVICE";
  }

  errors.push(
    "Tür yalnız Fiziksel Ürün veya Hizmet olabilir",
  );
  return undefined;
}

const FAMILY_ALIASES:
  Readonly<Record<string, StockV2ProductFamily>> = {
    "tül": "TUL",
    "tul": "TUL",
    "tul perde": "TUL",
    "fon": "FON",
    "güneşlik": "GUNESLIK",
    "guneslik": "GUNESLIK",
    "stor": "STOR",
    "zebra": "ZEBRA",
    "jaluzi": "JALUZI",
    "plicell": "PLICELL",
    "dikey tül": "DIKEY_TUL",
    "dikey tul": "DIKEY_TUL",
    "dikey stor": "DIKEY_STOR",
    "çeyizlik": "CEYIZLIK",
    "ceyizlik": "CEYIZLIK",
    "aksesuar": "AKSESUAR",
    "rustik": "RUSTIK",
    "diğer": "OTHER",
    "diger": "OTHER",
    "other": "OTHER",
  };

function parseFamily(
  value: unknown,
  errors: string[],
): StockV2ProductFamily | undefined {
  const raw = text(value);
  if (!raw) {
    errors.push("Ürün Ailesi zorunludur");
    return undefined;
  }

  const direct = raw.toLocaleUpperCase(
    "tr-TR",
  ) as StockV2ProductFamily;

  const allowed: StockV2ProductFamily[] = [
    "TUL",
    "FON",
    "GUNESLIK",
    "STOR",
    "ZEBRA",
    "JALUZI",
    "PLICELL",
    "DIKEY_TUL",
    "DIKEY_STOR",
    "CEYIZLIK",
    "AKSESUAR",
    "RUSTIK",
    "OTHER",
  ];

  if (allowed.includes(direct)) {
    return direct;
  }

  const family =
    FAMILY_ALIASES[
      raw.toLocaleLowerCase("tr-TR")
    ];

  if (!family) {
    errors.push(
      `Bilinmeyen Ürün Ailesi: ${raw}`,
    );
  }

  return family;
}

function expectedLegacyUnit(
  family: StockV2ProductFamily,
  suppliedUnit: string,
  errors: string[],
): string {
  const rule =
    resolveStockV2FamilyRule(family);

  if (rule.canonicalUnit === "mt") {
    const unit = normalizedName(suppliedUnit);
    if (
      unit &&
      !["mt", "metre", "m"].includes(unit)
    ) {
      errors.push(
        `Birim ürün ailesiyle uyumsuz: ${suppliedUnit}; beklenen mt`,
      );
    }
    return "Metre";
  }

  if (rule.canonicalUnit === "m2") {
    const unit = normalizedName(suppliedUnit)
      .replace("²", "2");
    if (
      unit &&
      !["m2", "m²"].includes(
        normalizedName(suppliedUnit),
      ) &&
      unit !== "m2"
    ) {
      errors.push(
        `Birim ürün ailesiyle uyumsuz: ${suppliedUnit}; beklenen m²`,
      );
    }
    return "m²";
  }

  if (rule.canonicalUnit === "adet") {
    const unit = normalizedName(suppliedUnit);
    if (unit && unit !== "adet") {
      errors.push(
        `Birim ürün ailesiyle uyumsuz: ${suppliedUnit}; beklenen adet`,
      );
    }
    return "Adet";
  }

  if (!suppliedUnit.trim()) {
    errors.push(
      "Bu ürün ailesinde Birim zorunludur",
    );
    return "";
  }

  return suppliedUnit.trim();
}

function parseFinishKind(
  value: unknown,
  errors: string[],
): StockV2BottomFinishKind | undefined {
  const normalized = normalizedName(value);

  if (
    normalized === "etek modeli" ||
    normalized === "hem_model"
  ) {
    return "HEM_MODEL";
  }

  if (
    normalized === "etek lazer" ||
    normalized === "hem_laser"
  ) {
    return "HEM_LASER";
  }

  errors.push(
    "Etek Türü yalnız Etek Modeli veya Etek Lazer olabilir",
  );
  return undefined;
}

function parsePricingBasis(
  value: unknown,
  errors: string[],
): StockV2PricingBasis | undefined {
  const normalized =
    normalizedName(value)
      .replace("²", "2");

  if (
    normalized === "en üzerinden mt" ||
    normalized === "en uzerinden mt" ||
    normalized === "width_meter"
  ) {
    return "WIDTH_METER";
  }

  if (
    normalized === "alan üzerinden m2" ||
    normalized === "alan uzerinden m2" ||
    normalized === "area_m2"
  ) {
    return "AREA_M2";
  }

  if (
    normalized === "adet" ||
    normalized === "piece"
  ) {
    return "PIECE";
  }

  if (
    normalized === "sabit" ||
    normalized === "sabit fiyat" ||
    normalized === "fixed"
  ) {
    return "FIXED";
  }

  errors.push(
    "Hesaplama: EN üzerinden mt / Alan üzerinden m² / Adet / Sabit olmalıdır",
  );
  return undefined;
}

function parseYesNo(
  value: unknown,
  label: string,
  errors: string[],
): boolean {
  try {
    return parseExcelYesNo(value) ?? false;
  } catch {
    errors.push(
      `${label}: yalnız Evet/Hayır olmalıdır`,
    );
    return false;
  }
}

function rowObject(
  row: unknown[],
  headers: string[],
): Record<string, unknown> {
  const result:
    Record<string, unknown> = {};

  headers.forEach((header, index) => {
    result[header] = row[index];
  });

  return result;
}

function requiredHeaders(
  actual: string[],
  required: readonly string[],
): string[] {
  const actualKeys = new Set(
    actual.map(key),
  );

  return required
    .filter(
      header => !actualKeys.has(key(header)),
    )
    .map(
      header => `Eksik kolon: ${header}`,
    );
}

export async function validateStockExcelFile(
  file: File,
  existingProducts: readonly StockExcelExistingProduct[],
  suppliers: readonly StockExcelSupplier[],
): Promise<StockExcelValidatedPlan> {
  const workbook = XLSX.read(
    await file.arrayBuffer(),
    { type: "array" },
  );

  const rows: StockExcelValidationRow[] = [];
  const cards: StockExcelPreparedCard[] = [];
  const finishes: StockExcelPreparedFinish[] = [];

  for (const requiredSheet of [
    STOCK_CARDS_SHEET_NAME,
    STOCK_BOTTOM_FINISH_SHEET_NAME,
  ]) {
    if (!workbook.SheetNames.includes(requiredSheet)) {
      rows.push({
        sheet: requiredSheet,
        rowNumber: 1,
        primary: requiredSheet,
        status: "ERROR",
        errors: [`Eksik çalışma sayfası: ${requiredSheet}`],
      });
    }
  }

  if (rows.length > 0) {
    return {
      cards,
      finishes,
      rows,
      errorCount: rows.length,
    };
  }

  const cardMatrix =
    XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[
        STOCK_CARDS_SHEET_NAME
      ],
      {
        header: 1,
        defval: "",
        raw: true,
      },
    );

  const cardHeaders = (
    cardMatrix[0] ?? []
  ).map(text);

  const cardHeaderErrors =
    requiredHeaders(
      cardHeaders,
      STOCK_CARD_TEMPLATE_HEADERS,
    );

  if (cardHeaderErrors.length > 0) {
    rows.push({
      sheet: STOCK_CARDS_SHEET_NAME,
      rowNumber: 1,
      primary: "Başlık",
      status: "ERROR",
      errors: cardHeaderErrors,
    });
  }

  const existingCodes = new Set(
    existingProducts.map(
      product => key(product.stockCode),
    ),
  );
  const existingBarcodes = new Set(
    existingProducts
      .flatMap(product => [
        product.barcode1,
        product.barcode2,
      ])
      .filter(Boolean)
      .map(key),
  );
  const fileCodes = new Set<string>();
  const fileBarcodes = new Set<string>();

  if (cardHeaderErrors.length === 0) {
    for (
      let index = 1;
      index < cardMatrix.length;
      index += 1
    ) {
      const raw = rowObject(
        cardMatrix[index],
        cardHeaders,
      );

      const hasAnyValue = Object.values(raw)
        .some(value => text(value).length > 0);

      if (!hasAnyValue) continue;

      const errors: string[] = [];
      const stockCode = text(
        raw["Stok Kodu"],
      );
      const name = text(raw["Stok Adı"]);

      if (!stockCode) {
        errors.push("Stok Kodu zorunludur");
      }
      if (!name) {
        errors.push("Stok Adı zorunludur");
      }

      const codeKey = key(stockCode);

      if (
        codeKey &&
        existingCodes.has(codeKey)
      ) {
        errors.push(
          "Stok kodu sistemde zaten var; otomatik güncelleme yapılmaz",
        );
      }

      if (
        codeKey &&
        fileCodes.has(codeKey)
      ) {
        errors.push(
          "Aynı stok kodu dosyada birden fazla kez kullanılmış",
        );
      }
      if (codeKey) fileCodes.add(codeKey);

      const productKind =
        parseKind(raw["Tür"], errors);

      let family:
        StockV2ProductFamily | undefined;
      let unit = text(raw["Birim"]);

      if (productKind === "PHYSICAL") {
        family = parseFamily(
          raw["Ürün Ailesi"],
          errors,
        );

        if (family) {
          unit = expectedLegacyUnit(
            family,
            unit,
            errors,
          );
        }
      } else if (
        productKind === "SERVICE"
      ) {
        unit = unit || "Hizmet";
      }

      const supplierName =
        text(raw["Tedarikçi"]);
      let supplierId:
        string | undefined;

      if (productKind === "PHYSICAL") {
        if (!supplierName) {
          errors.push(
            "Fiziksel ürün için Tedarikçi zorunludur",
          );
        } else {
          const matches =
            suppliers.filter(
              supplier =>
                normalizedName(
                  supplier.name,
                ) ===
                normalizedName(
                  supplierName,
                ),
            );

          if (matches.length === 0) {
            errors.push(
              `Tedarikçi bulunamadı: ${supplierName}`,
            );
          } else if (matches.length > 1) {
            errors.push(
              `Tedarikçi eşleşmesi belirsiz: ${supplierName}`,
            );
          } else {
            supplierId = matches[0].id;
          }
        }
      }

      const barcode1 =
        text(raw["Barkod 1"]) || undefined;
      const barcode2 =
        text(raw["Barkod 2"]) || undefined;

      for (const barcode of [
        barcode1,
        barcode2,
      ]) {
        if (!barcode) continue;
        const barcodeKey = key(barcode);

        if (
          existingBarcodes.has(barcodeKey)
        ) {
          errors.push(
            `Barkod sistemde zaten var: ${barcode}`,
          );
        }

        if (
          fileBarcodes.has(barcodeKey)
        ) {
          errors.push(
            `Barkod dosyada mükerrer: ${barcode}`,
          );
        }

        fileBarcodes.add(barcodeKey);
      }

      if (
        barcode1 &&
        barcode2 &&
        key(barcode1) === key(barcode2)
      ) {
        errors.push(
          "Barkod 1 ve Barkod 2 aynı olamaz",
        );
      }

      const card:
        StockExcelPreparedCard = {
          stockCode,
          name,
          productKind:
            productKind ?? "PHYSICAL",
          category:
            text(
              raw["Grup / Kategori"],
            ) || undefined,
          brand:
            text(raw["Marka"]) ||
            undefined,
          family,
          unit,
          supplierId,
          supplierName:
            supplierName || undefined,
          barcode1,
          barcode2,
          purchasePrice1:
            optionalNumber(
              raw["Alış Fiyatı 1"],
              "Alış Fiyatı 1",
              errors,
            ),
          purchasePrice2:
            optionalNumber(
              raw["Alış Fiyatı 2"],
              "Alış Fiyatı 2",
              errors,
            ),
          purchasePrice3:
            optionalNumber(
              raw["Alış Fiyatı 3"],
              "Alış Fiyatı 3",
              errors,
            ),
          purchasePrice4:
            optionalNumber(
              raw["Alış Fiyatı 4"],
              "Alış Fiyatı 4",
              errors,
            ),
          purchaseVatRate:
            optionalVat(
              raw["Alış KDV %"],
              "Alış KDV %",
              errors,
            ),
          salePrice1:
            optionalNumber(
              raw["Satış Fiyatı 1"],
              "Satış Fiyatı 1",
              errors,
            ),
          salePrice2:
            optionalNumber(
              raw["Satış Fiyatı 2"],
              "Satış Fiyatı 2",
              errors,
            ),
          salePrice3:
            optionalNumber(
              raw["Satış Fiyatı 3"],
              "Satış Fiyatı 3",
              errors,
            ),
          salePrice4:
            optionalNumber(
              raw["Satış Fiyatı 4"],
              "Satış Fiyatı 4",
              errors,
            ),
          saleVatRate:
            optionalVat(
              raw["Satış KDV %"],
              "Satış KDV %",
              errors,
            ),
          requiresSewing:
            parseYesNo(
              raw["Dikim Gerekir"],
              "Dikim Gerekir",
              errors,
            ),
          requiresInstallation:
            parseYesNo(
              raw["Montaj Gerekir"],
              "Montaj Gerekir",
              errors,
            ),
          extraDescription:
            text(
              raw["Ek Açıklama"],
            ) || undefined,
          description:
            text(
              raw["Genel Açıklama"],
            ) || undefined,
        };

      if (
        productKind === "SERVICE" &&
        (
          card.requiresSewing ||
          card.requiresInstallation
        )
      ) {
        errors.push(
          "Hizmet kartında Dikim/Montaj gerekir alanları kullanılamaz",
        );
      }

      rows.push({
        sheet:
          STOCK_CARDS_SHEET_NAME,
        rowNumber: index + 1,
        primary:
          stockCode || name || "-",
        status:
          errors.length > 0
            ? "ERROR"
            : "OK",
        errors,
      });

      if (errors.length === 0) {
        cards.push(card);
      }
    }
  }

  const cardByCode = new Map(
    cards.map(card => [
      key(card.stockCode),
      card,
    ]),
  );

  const finishMatrix =
    XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[
        STOCK_BOTTOM_FINISH_SHEET_NAME
      ],
      {
        header: 1,
        defval: "",
        raw: true,
      },
    );

  const finishHeaders = (
    finishMatrix[0] ?? []
  ).map(text);

  const finishHeaderErrors =
    requiredHeaders(
      finishHeaders,
      STOCK_BOTTOM_FINISH_TEMPLATE_HEADERS,
    );

  if (
    finishHeaderErrors.length > 0
  ) {
    rows.push({
      sheet:
        STOCK_BOTTOM_FINISH_SHEET_NAME,
      rowNumber: 1,
      primary: "Başlık",
      status: "ERROR",
      errors: finishHeaderErrors,
    });
  } else {
    const optionKeys = new Set<string>();

    for (
      let index = 1;
      index < finishMatrix.length;
      index += 1
    ) {
      const raw = rowObject(
        finishMatrix[index],
        finishHeaders,
      );

      const hasAnyValue = Object.values(raw)
        .some(value => text(value).length > 0);

      if (!hasAnyValue) continue;

      const errors: string[] = [];
      const stockCode =
        text(raw["Stok Kodu"]);
      const code =
        text(raw["Model Kodu"]);
      const name =
        text(raw["Model Adı"]);

      if (!stockCode) {
        errors.push("Stok Kodu zorunludur");
      }
      if (!code) {
        errors.push("Model Kodu zorunludur");
      }
      if (!name) {
        errors.push("Model Adı zorunludur");
      }

      const parent =
        cardByCode.get(key(stockCode));

      if (!parent) {
        errors.push(
          "Etek satırı aynı dosyadaki temiz bir STOK KARTLARI satırına bağlanmalıdır",
        );
      } else {
        if (
          parent.productKind !== "PHYSICAL"
        ) {
          errors.push(
            "Hizmet kartına Etek Modeli / Etek Lazer bağlanamaz",
          );
        }

        if (
          parent.family !== "STOR" &&
          parent.family !== "ZEBRA"
        ) {
          errors.push(
            "Etek Modeli / Etek Lazer yalnız Stor veya Zebra ürününde kullanılabilir",
          );
        }
      }

      const kind =
        parseFinishKind(
          raw["Tür"],
          errors,
        );
      const pricingBasis =
        parsePricingBasis(
          raw["Hesaplama"],
          errors,
        );

      if (kind && code) {
        const optionKey = [
          key(stockCode),
          kind,
          key(code),
        ].join("|");

        if (
          optionKeys.has(optionKey)
        ) {
          errors.push(
            "Aynı stok + tür + model kodu dosyada mükerrer",
          );
        }

        optionKeys.add(optionKey);
      }

      const finish:
        StockExcelPreparedFinish = {
          stockCode,
          kind:
            kind ?? "HEM_MODEL",
          code,
          name,
          pricingBasis:
            pricingBasis ??
            "WIDTH_METER",
          purchaseUnitPrice:
            optionalNumber(
              raw["Alış Fiyatı"],
              "Alış Fiyatı",
              errors,
            ),
          purchaseVatRate:
            optionalVat(
              raw["Alış KDV %"],
              "Alış KDV %",
              errors,
            ),
          saleUnitPrice:
            optionalNumber(
              raw["Satış Fiyatı"],
              "Satış Fiyatı",
              errors,
            ),
          saleVatRate:
            optionalVat(
              raw["Satış KDV %"],
              "Satış KDV %",
              errors,
            ),
        };

      rows.push({
        sheet:
          STOCK_BOTTOM_FINISH_SHEET_NAME,
        rowNumber: index + 1,
        primary:
          `${stockCode} — ${code}`,
        status:
          errors.length > 0
            ? "ERROR"
            : "OK",
        errors,
      });

      if (errors.length === 0) {
        finishes.push(finish);
      }
    }
  }

  const errorCount =
    rows.filter(
      row => row.status === "ERROR",
    ).length;

  return {
    cards,
    finishes,
    rows,
    errorCount,
  };
}

export interface StockExcelExportProduct {
  id: string;
  stockCode: string;
  name: string;
  productKind?: "PHYSICAL" | "SERVICE";
  category?: string;
  brand?: string;
  unit?: string;
  defaultSupplierCustomerId?: string;
  barcode1?: string;
  barcode2?: string;
  purchasePrice1?: number;
  purchasePrice2?: number;
  purchasePrice3?: number;
  purchasePrice4?: number;
  purchaseVatRate?: number;
  salePrice1?: number;
  salePrice2?: number;
  salePrice3?: number;
  salePrice4?: number;
  saleVatRate?: number;
  requiresSewing?: boolean;
  requiresInstallation?: boolean;
  additionalDescription?: string;
  generalDescription?: string;
}

export interface StockExcelExportProfile {
  productId: string;
  family: StockV2ProductFamily;
}

export interface StockExcelExportFinish {
  productId: string;
  kind: StockV2BottomFinishKind;
  code: string;
  name: string;
  pricingBasis: StockV2PricingBasis;
  purchaseUnitPrice?: number;
  purchaseVatRate?: number;
  saleUnitPrice?: number;
  saleVatRate?: number;
}

function kindLabel(
  kind: StockV2BottomFinishKind,
): string {
  return kind === "HEM_MODEL"
    ? "Etek Modeli"
    : "Etek Lazer";
}

function basisLabel(
  basis: StockV2PricingBasis,
): string {
  if (basis === "WIDTH_METER") {
    return "EN üzerinden mt";
  }
  if (basis === "AREA_M2") {
    return "Alan üzerinden m²";
  }
  if (basis === "PIECE") {
    return "Adet";
  }
  return "Sabit";
}

export function downloadStockExcelData(input: {
  products: readonly StockExcelExportProduct[];
  suppliers: readonly StockExcelSupplier[];
  profiles: readonly StockExcelExportProfile[];
  finishes: readonly StockExcelExportFinish[];
  includePurchasePrices: boolean;
  includeSalePrices: boolean;
  canViewPhysical: boolean;
  canViewService: boolean;
  fileName?: string;
}): void {
  const supplierNames =
    new Map(
      input.suppliers.map(
        supplier => [
          supplier.id,
          supplier.name,
        ],
      ),
    );

  const profileByProduct =
    new Map(
      input.profiles.map(
        profile => [
          profile.productId,
          profile,
        ],
      ),
    );

  const visibleProducts =
    input.products.filter(product => {
      const isService =
        product.productKind === "SERVICE";
      return isService
        ? input.canViewService
        : input.canViewPhysical;
    });

  const productById =
    new Map(
      visibleProducts.map(
        product => [
          product.id,
          product,
        ],
      ),
    );

  const cardRows = visibleProducts.map(
    product => {
      const isService =
        product.productKind === "SERVICE";
      const profile =
        profileByProduct.get(
          product.id,
        );

      return {
        "Stok Kodu": product.stockCode,
        "Stok Adı": product.name,
        "Tür": isService
          ? "Hizmet"
          : "Fiziksel Ürün",
        "Grup / Kategori":
          product.category ?? "",
        "Marka":
          product.brand ?? "",
        "Ürün Ailesi":
          isService
            ? ""
            : profile?.family ?? "",
        "Birim":
          product.unit ?? "",
        "Tedarikçi":
          product.defaultSupplierCustomerId
            ? supplierNames.get(
                product.defaultSupplierCustomerId,
              ) ?? ""
            : "",
        "Barkod 1":
          product.barcode1 ?? "",
        "Barkod 2":
          product.barcode2 ?? "",
        "Alış Fiyatı 1":
          input.includePurchasePrices
            ? product.purchasePrice1 ?? ""
            : "",
        "Alış Fiyatı 2":
          input.includePurchasePrices
            ? product.purchasePrice2 ?? ""
            : "",
        "Alış Fiyatı 3":
          input.includePurchasePrices
            ? product.purchasePrice3 ?? ""
            : "",
        "Alış Fiyatı 4":
          input.includePurchasePrices
            ? product.purchasePrice4 ?? ""
            : "",
        "Alış KDV %":
          input.includePurchasePrices
            ? product.purchaseVatRate ?? ""
            : "",
        "Satış Fiyatı 1":
          input.includeSalePrices
            ? product.salePrice1 ?? ""
            : "",
        "Satış Fiyatı 2":
          input.includeSalePrices
            ? product.salePrice2 ?? ""
            : "",
        "Satış Fiyatı 3":
          input.includeSalePrices
            ? product.salePrice3 ?? ""
            : "",
        "Satış Fiyatı 4":
          input.includeSalePrices
            ? product.salePrice4 ?? ""
            : "",
        "Satış KDV %":
          input.includeSalePrices
            ? product.saleVatRate ?? ""
            : "",
        "Dikim Gerekir":
          product.requiresSewing
            ? "Evet"
            : "Hayır",
        "Montaj Gerekir":
          product.requiresInstallation
            ? "Evet"
            : "Hayır",
        "Ek Açıklama":
          product.additionalDescription ??
          "",
        "Genel Açıklama":
          product.generalDescription ??
          "",
      };
    },
  );

  const finishRows =
    input.finishes
      .filter(
        finish =>
          productById.has(
            finish.productId,
          ),
      )
      .map(finish => {
        const product =
          productById.get(
            finish.productId,
          );

        return {
          "Stok Kodu":
            product?.stockCode ?? "",
          "Tür":
            kindLabel(finish.kind),
          "Model Kodu":
            finish.code,
          "Model Adı":
            finish.name,
          "Hesaplama":
            basisLabel(
              finish.pricingBasis,
            ),
          "Alış Fiyatı":
            input.includePurchasePrices
              ? finish.purchaseUnitPrice ??
                ""
              : "",
          "Alış KDV %":
            input.includePurchasePrices
              ? finish.purchaseVatRate ??
                ""
              : "",
          "Satış Fiyatı":
            input.includeSalePrices
              ? finish.saleUnitPrice ??
                ""
              : "",
          "Satış KDV %":
            input.includeSalePrices
              ? finish.saleVatRate ??
                ""
              : "",
        };
      });

  const workbook =
    XLSX.utils.book_new();

  const cardSheet =
    cardRows.length > 0
      ? XLSX.utils.json_to_sheet(
          cardRows,
          {
            header: [
              ...STOCK_CARD_TEMPLATE_HEADERS,
            ],
          },
        )
      : XLSX.utils.aoa_to_sheet([
          [
            ...STOCK_CARD_TEMPLATE_HEADERS,
          ],
        ]);

  const finishSheet =
    finishRows.length > 0
      ? XLSX.utils.json_to_sheet(
          finishRows,
          {
            header: [
              ...STOCK_BOTTOM_FINISH_TEMPLATE_HEADERS,
            ],
          },
        )
      : XLSX.utils.aoa_to_sheet([
          [
            ...STOCK_BOTTOM_FINISH_TEMPLATE_HEADERS,
          ],
        ]);

  XLSX.utils.book_append_sheet(
    workbook,
    cardSheet,
    STOCK_CARDS_SHEET_NAME,
  );

  XLSX.utils.book_append_sheet(
    workbook,
    finishSheet,
    STOCK_BOTTOM_FINISH_SHEET_NAME,
  );

  XLSX.writeFile(
    workbook,
    `${
      input.fileName ??
      "ENVerp_Stok_Kartlari"
    }.xlsx`,
  );
}