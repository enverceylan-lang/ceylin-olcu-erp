import assert from "node:assert/strict";
import fs from "node:fs";
import {
  resolveMeasurementDisplayDimensions,
  resolveMeasurementDisplayLabel,
} from "../src/lib/measurementAdapter";
import { buildWhatsAppShortReport } from "../src/lib/reportFormatters";
import type { MeasurementRecord } from "../src/store/measurementStore";
import type { Customer } from "../src/store/useStore";

const baseMeasurement: MeasurementRecord = {
  id: "measurement-1",
  customerId: "customer-1",
  customerAddressId: "address-1",
  roomId: "room-1",
  openingId: "opening-1",
  windowId: "opening-1",
  templateType: "SIMPLE_WIDTH_HEIGHT",
  rawValues: { width: 300, height: 250 },
  status: "ACTIVE",
  measuredBy: "ENVER CEYLAN",
  measuredDate: "2026-09-21T12:00:00.000Z",
  notes: "Kumaş payını kontrol et",
  notesHistory: [],
  photos: [],
  videos: [],
};

const simple = resolveMeasurementDisplayDimensions(baseMeasurement);
assert.equal(simple.displayWidth, 300);
assert.equal(simple.displayHeight, 250);
assert.equal(simple.dimensionText, "300 × 250 cm");

const fullHeightDetail = resolveMeasurementDisplayDimensions({
  ...baseMeasurement,
  templateType: "CURTAIN_DETAIL",
  rawValues: {
    facadeSegments: [{ id: "segment-1", label: "Cam", type: "C", widthCm: 323 }],
    solYukseklikCm: 260,
  },
});
assert.equal(fullHeightDetail.displayWidth, 323);
assert.equal(fullHeightDetail.displayHeight, 260);
assert.match(fullHeightDetail.dimensionText, /323 × 260 cm/);

const fullHeightPrecedesAlternative = resolveMeasurementDisplayDimensions({
  ...baseMeasurement,
  templateType: "CURTAIN_DETAIL",
  rawValues: {
    facadeSegments: [{ id: "segment-1", label: "Cam", type: "C", widthCm: 323 }],
    windowHeight: 260,
    kaloriferMermerBoyuCm: 200,
  },
});
assert.equal(fullHeightPrecedesAlternative.displayHeight, 260);
assert.match(fullHeightPrecedesAlternative.dimensionText, /323 × 260 cm/);

const radiatorDetail = resolveMeasurementDisplayDimensions({
  ...baseMeasurement,
  templateType: "CURTAIN_DETAIL",
  rawValues: {
    facadeSegments: [{ id: "segment-1", label: "Cam", type: "C", widthCm: 323 }],
    kaloriferMermerBoyuCm: 200,
  },
});
assert.equal(radiatorDetail.displayWidth, 323);
assert.equal(radiatorDetail.displayHeight, 200);
assert.match(radiatorDetail.dimensionText, /323 × 200 cm/);
assert.match(radiatorDetail.dimensionText, /Kalorifer\/Mermer/);
assert.doesNotMatch(radiatorDetail.dimensionText, /[×xX]\s*0\b/);

const multiHeightDetail = resolveMeasurementDisplayDimensions({
  ...baseMeasurement,
  templateType: "CURTAIN_DETAIL",
  rawValues: {
    facadeSegments: [{ id: "segment-1", label: "Cam", type: "C", widthCm: 323 }],
    solYukseklikCm: 260,
    ortaYukseklikCm: 258,
    sagYukseklikCm: 255,
  },
});
assert.equal(multiHeightDetail.displayHeight, 255);
assert.equal(
  multiHeightDetail.dimensionText,
  "En: 323 cm • Boy: Sol 260 / Orta 258 / Sağ 255 cm",
);

const noHeight = resolveMeasurementDisplayDimensions({
  ...baseMeasurement,
  templateType: "CURTAIN_DETAIL",
  rawValues: {
    facadeSegments: [{ id: "segment-1", label: "Cam", type: "C", widthCm: 323 }],
  },
});
assert.equal(noHeight.displayHeight, null);
assert.equal(noHeight.dimensionText, "En: 323 cm • Boy belirtilmemiş");
assert.doesNotMatch(noHeight.dimensionText, /[×xX]\s*0\b/);

const exactLabel = resolveMeasurementDisplayLabel(baseMeasurement, {
  verifiedRoom: { id: "room-1", name: "Salon", index: 0 },
  verifiedOpening: { id: "opening-1", name: "Kapı Tarafı", index: 0 },
});
assert.deepEqual(exactLabel, {
  roomLabel: "Salon",
  openingLabel: "Kapı Tarafı",
});

const blankCanonicalLabel = resolveMeasurementDisplayLabel(
  { ...baseMeasurement, openingName: "Karşı Cam" },
  {
    verifiedRoom: { id: "room-1", name: "Salon", index: 0 },
    verifiedOpening: { id: "opening-1", name: "", index: 1 },
  },
);
assert.equal(blankCanonicalLabel.openingLabel, "Karşı Cam");

const indexedFallback = resolveMeasurementDisplayLabel(baseMeasurement, {
  verifiedRoom: { id: "room-1", name: "Salon", index: 0 },
  verifiedOpening: { id: "opening-1", name: "", index: 1 },
});
assert.equal(indexedFallback.openingLabel, "Açıklık 2");

const mismatchedParent = resolveMeasurementDisplayLabel(
  { ...baseMeasurement, openingName: "Yanlış Başlık" },
  {
    verifiedRoom: { id: "room-1", name: "Salon", index: 0 },
    verifiedOpening: { id: "opening-2", name: "Başka Açıklık", index: 1 },
  },
);
assert.equal(mismatchedParent.openingLabel, "Açıklık adı bulunamadı");

const customer: Customer = {
  id: "customer-1",
  name: "WORK MÜDÜR",
  phone: "",
  address: "LEGACY ADRES YAZILMAMALI",
  mapLocation: "LEGACY HARITA YAZILMAMALI",
  addresses: [
    {
      id: "address-1",
      customerId: "customer-1",
      title: "Ev",
      address: "Meram / Konya",
      mapLocation: "",
      isDeleted: false,
    },
  ],
  notes: "",
  rooms: [
    {
      id: "room-1",
      customerAddressId: "address-1",
      name: "Salon",
      photos: [],
      videos: [],
      windows: [
        {
          id: "opening-1",
          name: "Kapı Tarafı",
          photos: [],
          videos: [],
          products: [],
        },
      ],
    },
  ],
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:00.000Z",
  createdById: "user-1",
  createdByName: "ENVER CEYLAN",
  addressPhotos: [],
};

const whatsapp = buildWhatsAppShortReport(
  customer,
  [],
  [
    {
      ...baseMeasurement,
      templateType: "CURTAIN_DETAIL",
      rawValues: {
        facadeSegments: [{ id: "segment-1", label: "Cam", type: "C", widthCm: 323 }],
        kaloriferMermerBoyuCm: 200,
      },
    },
  ],
  "ENVerp",
);
assert.match(whatsapp, /Müşteri: WORK MÜDÜR/);
assert.match(whatsapp, /Adres: Meram \/ Konya/);
assert.doesNotMatch(whatsapp, /LEGACY ADRES YAZILMAMALI/);
assert.doesNotMatch(whatsapp, /LEGACY HARITA YAZILMAMALI/);
assert.match(whatsapp, /\*SALON\*/);
assert.match(whatsapp, /Kapı Tarafı/);
assert.match(whatsapp, /Toplam en: 323 cm/);
assert.match(whatsapp, /Boy: Kalorifer\/Mermer 200 cm/);
assert.match(whatsapp, /Not: Kumaş payını kontrol et/);
assert.doesNotMatch(whatsapp, /323\s*[×xX]\s*0/);


const plicellWhatsapp = buildWhatsAppShortReport(
  customer,
  [],
  [
    {
      ...baseMeasurement,
      templateType: "PLICELL",
      productType: "PLICELL",
      rawValues: {
        plicellCamListesi: [
          { widthCm: 100, heightCm: 200 },
        ],
      },
    },
  ],
  "ENVerp",
);
assert.match(plicellWhatsapp, /Adres: Meram \/ Konya/);
assert.doesNotMatch(plicellWhatsapp, /LEGACY ADRES YAZILMAMALI/);
assert.doesNotMatch(plicellWhatsapp, /LEGACY HARITA YAZILMAMALI/);

const visualSource = fs.readFileSync(
  "src/components/reports/MeasurementVisualReport.tsx",
  "utf8",
);
const pdfSource = fs.readFileSync(
  "src/lib/measurementPdfGenerator.ts",
  "utf8",
);
const customerPageSource = fs.readFileSync(
  "src/app/cariler/[id]/page.tsx",
  "utf8",
);
const measurementsPageSource = fs.readFileSync(
  "src/app/olculer/page.tsx",
  "utf8",
);

const reportFormatterSource = fs.readFileSync(
  "src/lib/reportFormatters.ts",
  "utf8",
);
assert.match(reportFormatterSource, /resolveBoundRoomAddress/);
assert.doesNotMatch(
  reportFormatterSource,
  /customer\.address\s*\|\|\s*customer\.mapLocation/,
);

for (const [name, source] of [
  ["visual", visualSource],
  ["pdf", pdfSource],
  ["customer-page", customerPageSource],
  ["measurements-page", measurementsPageSource],
] as const) {
  assert.match(
    source,
    /resolveMeasurementDisplayDimensions/,
    `${name} canonical display projection kullanmıyor`,
  );
}

assert.match(visualSource, /resolveMeasurementDisplayLabel/);
assert.match(pdfSource, /resolveMeasurementDisplayLabel/);
assert.doesNotMatch(
  customerPageSource,
  /Üretim Ölçüsü:\s*\$\{p\.calculatedWidth\}x\$\{p\.calculatedHeight\}/,
);

console.log("[PASS] measurementDisplayReportSameLineSuite completed");


/* ENVERP_PLICELL_SUMMARY_SEMANTICS_V1 */
const plicellSummaryProjection =
  resolveMeasurementDisplayDimensions({
    ...baseMeasurement,
    templateType: "PLICELL",
    productType: "PLICELL",
    rawValues: {
      plicellCamListesi: [
        { widthCm: 44.5, heightCm: 92 },
        { widthCm: 17, heightCm: 192 },
        { widthCm: 88, heightCm: 45 },
      ],
    },
  });

assert.equal(
  plicellSummaryProjection.displayWidth,
  88,
);
assert.equal(
  plicellSummaryProjection.displayHeight,
  192,
);
assert.equal(
  plicellSummaryProjection.dimensionText,
  "88 × 192 cm",
);
assert.match(
  plicellSummaryProjection.summaryLabel,
  /^3 cam • Toplam [0-9]+[.][0-9]{2} m²$/,
);
assert.notEqual(
  plicellSummaryProjection.summaryLabel,
  plicellSummaryProjection.dimensionText,
);
