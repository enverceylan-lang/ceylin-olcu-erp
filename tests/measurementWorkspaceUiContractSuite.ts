import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CustomerMeasurementsWorkspace } from "../src/components/measurements/CustomerMeasurementsWorkspace";
import { MeasurementCapturePanel } from "../src/components/measurements/MeasurementCapturePanel";
import {
  MeasurementsExplorerPanel,
  resolveMeasurementExplorerLabel,
} from "../src/components/measurements/MeasurementsExplorerPanel";

function workspaceKeepsCaptureExplorerTabsOnAllLayouts(): void {
  const captureHtml = renderToStaticMarkup(
    React.createElement(
      CustomerMeasurementsWorkspace,
      {
        tab: "CAPTURE",
        onCapture: () => undefined,
        onExplorer: () => undefined,
        capture: React.createElement(
          "div",
          { id: "capture-probe" },
          "CAPTURE",
        ),
        explorer: React.createElement(
          "div",
          { id: "explorer-probe" },
          "EXPLORER",
        ),
      },
    ),
  );

  assert.match(
    captureHtml,
    /data-enverp-measurement-workspace="stitch-v2"/,
  );
  assert.match(captureHtml, />Ölçü Al</);
  assert.match(captureHtml, />Odalar \/ Ölçüler</);
  assert.match(
    captureHtml,
    /data-workspace-pane="capture"/,
  );
  assert.doesNotMatch(
    captureHtml,
    /lg:hidden/,
  );
  assert.doesNotMatch(
    captureHtml,
    /lg:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(360px,0\.85fr\)\]/,
  );

  const explorerHtml = renderToStaticMarkup(
    React.createElement(
      CustomerMeasurementsWorkspace,
      {
        tab: "EXPLORER",
        onCapture: () => undefined,
        onExplorer: () => undefined,
        capture: React.createElement("div", null, "CAPTURE"),
        explorer: React.createElement("div", null, "EXPLORER"),
      },
    ),
  );
  assert.match(
    explorerHtml,
    /data-workspace-pane="explorer"/,
  );

  console.log(
    "[PASS] workspaceKeepsCaptureExplorerTabsOnAllLayouts",
  );
}

function explorerKeepsSingleRoomCtaAndFrequentActions(): void {
  const html = renderToStaticMarkup(
    React.createElement(MeasurementsExplorerPanel, {
      rooms: [
        {
          id: "room-1",
          name: "Salon",
          directMeasurements: [
            {
              id: "measurement-direct",
              fallbackIndex: 1,
              templateLabel: "Basit En-Boy Ölçüsü",
              summary: "200 × 250 cm",
              statusLabel: "MEASURED",
              canMutate: true,
              highlighted: true,
            },
          ],
          openings: [
            {
              id: "opening-1",
              name: "Balkon Kapısı",
              measurements: [
                {
                  id: "measurement-opening",
                  measurementLabel: "Kapı Net Ölçüsü",
                  fallbackIndex: 1,
                  templateLabel: "Detay Perde Ölçüsü",
                  summary: "180 × 240 cm",
                  canMutate: false,
                  highlighted: false,
                },
              ],
            },
          ],
        },
      ],
      onAddMeasurement: () => undefined,
      onEditMeasurement: () => undefined,
      onDeleteMeasurement: () => undefined,
      onOpenSalesPreparation: () => undefined,
      onOpenVisualReport: () => undefined,
      onShareWhatsApp: () => undefined,
      onTransferToSale: () => undefined,
      onRecoverMeasurements: () => undefined,
      selectedMeasurementId: "measurement-opening",
      onSelectMeasurement: () => undefined,
    }),
  );

  assert.equal(
    (html.match(/Bu Odanın Ölçüsünü Al/g) || []).length,
    1,
    "Room CTA should render once per room",
  );
  assert.match(html, /Açıklık \/ Grup: Balkon Kapısı/);
  assert.match(html, />Görsel Rapor</);
  assert.match(html, />Satışa Hazırlık</);
  assert.match(html, />Satışa Aktar</);
  assert.match(html, />WhatsApp Kısa Rapor</);
  assert.match(html, /Diğer işlemler/);
  assert.match(html, />Ölçü Kurtar</);
  assert.doesNotMatch(html, /Alt Sıraya Yeni Oda Ekle/);
  assert.match(html, />Yeni</);
  assert.match(html, /Salon\s*→\s*Balkon Kapısı/);

  console.log(
    "[PASS] explorerKeepsSingleRoomCtaAndFrequentActions",
  );
}

function displayFallbackNeverBecomesIdentity(): void {
  assert.equal(
    resolveMeasurementExplorerLabel(
      "  Müşteri Etiketi  ",
      8,
    ),
    "Müşteri Etiketi",
  );
  assert.equal(
    resolveMeasurementExplorerLabel(undefined, 3),
    "Ölçü 3",
  );

  console.log(
    "[PASS] displayFallbackNeverBecomesIdentity",
  );
}

function captureKeepsRoomContextAndNoSecondRoomCreate(): void {
  const html = renderToStaticMarkup(
    React.createElement(MeasurementCapturePanel, {
      rooms: [
        {
          id: "room-1",
          name: "Salon",
          openings: [
            {
              id: "opening-1",
              name: "Pencere 1",
            },
          ],
        },
      ],
      selectedRoomId: "room-1",
      selectedOpeningId: "",
      activeParentId: "__ROOM_DIRECT__",
      directParentId: "__ROOM_DIRECT__",
      isEditing: false,
      onRoomChange: () => undefined,
      onOpeningChange: () => undefined,
      onStart: () => undefined,
      onCreateOpening: async () => "opening-new",
      renderForm: () =>
        React.createElement("div", null, "FORM"),
    }),
  );

  assert.match(html, /Salon için yeni ölçü/);
  assert.match(html, /Doğrudan odaya ölçü/);
  assert.match(html, /\+ Açıklık \/ Grup/);
  assert.match(html, />FORM</);
  assert.doesNotMatch(html, /\+ Yeni Oda/);
  assert.doesNotMatch(html, /Bu Odanın Ölçüsünü Al/);

  console.log(
    "[PASS] captureKeepsRoomContextAndNoSecondRoomCreate",
  );
}

function pageWiringKeepsOneMeasurementAuthorityAndSaveFlow(): void {
  const pagePath = path.resolve(
    process.cwd(),
    "src/app/cariler/[id]/page.tsx",
  );
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(
    source,
    /<CustomerMeasurementsWorkspace/,
  );
  assert.match(source, /capture=\{/);
  assert.match(source, /explorer=\{/);
  assert.match(
    source,
    /\{Boolean\(mode !== "MEASUREMENT"\) && \(/,
  );
  assert.match(
    source,
    /setMeasurementWorkspaceTab\("EXPLORER"\)/,
  );
  assert.match(
    source,
    /setLastSavedMeasurementId\(/,
  );
  assert.match(
    source,
    /setSelectedExplorerMeasurementId\(savedId\)/,
  );
  assert.match(
    source,
    /selectedMeasurementId=\{\s*selectedExplorerMeasurementId\s*\}/,
  );
  assert.match(
    source,
    /onSelectMeasurement=\{\s*setSelectedExplorerMeasurementId\s*\}/,
  );
  assert.match(
    source,
    /onOpenVisualReport=\{\(\) =>\s*setIsVisualReportOpen\(true\)\s*\}/,
  );
  assert.match(
    source,
    /onShareWhatsApp=\{\(\) =>\s*void handleShareWhatsAppReport\(\)\s*\}/,
  );
  assert.match(
    source,
    /onTransferToSale=\{\s*canTransferToSale/,
  );
  assert.match(
    source,
    /onRecoverMeasurements=\{/,
  );
  assert.match(source, /openRoomPreparation\(room\)/);
  assert.match(source, /syncNow\(\)/);

  console.log(
    "[PASS] pageWiringKeepsOneMeasurementAuthorityAndSaveFlow",
  );
}

workspaceKeepsCaptureExplorerTabsOnAllLayouts();
explorerKeepsSingleRoomCtaAndFrequentActions();
displayFallbackNeverBecomesIdentity();
captureKeepsRoomContextAndNoSecondRoomCreate();
pageWiringKeepsOneMeasurementAuthorityAndSaveFlow();

console.log(
  "PAK_MEASUREMENT_WORKSPACE_UI_CONTRACT_V2",
);
