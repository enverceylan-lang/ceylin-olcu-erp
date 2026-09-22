import assert from "node:assert/strict";
import fs from "node:fs";

import {
  createDraftSaleFromCustomer,
  normalizeSaleTransferBundleRefsV1,
  saleItemContainsTransferBundleV1,
  saleTransferBundleKeyV1,
  syncOrCreateDraftSale,
} from "../src/lib/salesAdapter";
import { useMeasurementStore } from "../src/store/measurementStore";
import type { ErpScope } from "../src/lib/erpScope";

const modal = fs.readFileSync(
  "src/components/reports/RoomPreparationModal.tsx",
  "utf8",
);
const page = fs.readFileSync(
  "src/app/cariler/[id]/page.tsx",
  "utf8",
);
const adapter = fs.readFileSync(
  "src/lib/salesAdapter.ts",
  "utf8",
);

assert.match(
  modal,
  /const \[transferSelections, setTransferSelections\][\s\S]*useState<Record<string, string\[\]>>\(\{\}\)/,
  "transfer selection must have separate transient state",
);

assert.match(
  modal,
  /setTransferSelections\(\{\}\)/,
  "transfer selection must start empty on modal open",
);

assert.match(
  modal,
  /Satışa aktarılacak en az bir ürün seçin\./,
  "empty transfer selection must fail closed",
);

assert.match(
  modal,
  /Odadaki aktif ürünleri satışa seç/,
  "room-level select-all convenience must exist",
);

assert.match(
  modal,
  /<span>Satışa aktar<\/span>/,
  "product-level transfer checkbox must exist",
);

assert.match(
  modal,
  /selectedProducts: newSelected/,
  "existing product-intent persistence must remain intact",
);

assert.match(
  page,
  /syncOrCreateDraftSale\([\s\S]*scope,[\s\S]*undefined,[\s\S]*undefined,[\s\S]*transferSelection[\s\S]*\)/,
  "Cari bridge must pass explicit transfer selection",
);

assert.match(
  page,
  /returnSaleId,[\s\S]*undefined,[\s\S]*transferToSale[\s\S]*\?[\s\S]*transferSelection[\s\S]*:[\s\S]*undefined/,
  "existing draft return flow must honor explicit transfer selection without changing legacy Kaydet semantics",
);

assert.match(
  adapter,
  /SALE_TRANSFER_SELECTION_REQUIRED/,
  "empty explicit selection must be rejected in adapter too",
);

const normalized = normalizeSaleTransferBundleRefsV1([
  { measurementId: " m-1 ", productType: "TUL" },
  { measurementId: "m-1", productType: "TUL" },
  { measurementId: "m-2", productType: " FON " },
  { measurementId: "", productType: "STOR" },
]);

assert.deepEqual(normalized, [
  { measurementId: "m-1", productType: "TUL" },
  { measurementId: "m-2", productType: "FON" },
]);

assert.equal(
  saleTransferBundleKeyV1({
    measurementId: "m-1",
    productType: "tül",
  }),
  saleTransferBundleKeyV1({
    measurementId: "m-1",
    productType: "TÜL",
  }),
  "bundle key must normalize product type case",
);

const groupedItem = {
  id: "m-1-TUL-g0",
  measurementId: "m-1,m-2",
  productionBreakdown: [
    { id: "m-2-TUL-g0" },
  ],
};

assert.equal(
  saleItemContainsTransferBundleV1(
    groupedItem as never,
    { measurementId: "m-1", productType: "TUL" },
  ),
  true,
  "first grouped bundle must be detected from item id",
);

assert.equal(
  saleItemContainsTransferBundleV1(
    groupedItem as never,
    { measurementId: "m-2", productType: "TUL" },
  ),
  true,
  "later grouped bundle must be detected from production breakdown",
);

assert.equal(
  saleItemContainsTransferBundleV1(
    groupedItem as never,
    { measurementId: "m-2", productType: "FON" },
  ),
  false,
  "different product intent must not match",
);


type DraftStore =
  Parameters<typeof syncOrCreateDraftSale>[1];

type DraftSale =
  DraftStore["sales"][number];

type SaleItemFixture =
  DraftSale["items"][number];

const behaviorActor = {
  id: "selection-gate-user",
  username: "selection-gate-user",
  name: "Selection Gate User",
};

const behaviorScope: ErpScope = {
  tenantId: "tenant-selection-v1",
  companyId: "company-selection-v1",
  branchId: "branch-selection-v1",
  accountingPeriodId: "period-selection-v1",
};

const behaviorCustomer =
  {
    id: "customer-selection-v1",
    name: "Selection Gate Customer",
    phone: "5550000000",
    address: "",
    mapLocation: "",
    notes: "",
    rooms: [
      {
        id: "room-selection-v1",
        name: "Salon",
        photos: [],
        videos: [],
        windows: [
          {
            id: "opening-selection-v1",
            name: "Açıklık 1",
            photos: [],
            videos: [],
          },
        ],
      },
    ],
    addresses: [],
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  } as unknown as Parameters<
    typeof createDraftSaleFromCustomer
  >[0];

function textileCalculation(
  productType: string,
  id: string,
  quantity: number,
) {
  return {
    productType,
    calculationVersion: "SELECTION-GATE-TEST-V1",
    fabricUsageMeters: quantity,
    salesItems: [
      {
        id,
        productType,
        label: productType,
        unit: "mt",
        quantity,
        fabricMeters: quantity,
      },
    ],
    warnings: [],
  };
}

const selectedMeasurement =
  {
    id: "measurement-selection-v1",
    customerId: behaviorCustomer.id,
    roomId: "room-selection-v1",
    openingId: "opening-selection-v1",
    windowId: "opening-selection-v1",
    templateType: "CURTAIN",
    productType: "TUL",
    rawValues: {
      windowWidth: 150,
      windowHeight: 260,
    },
    selectedProducts: [
      {
        productType: "TUL",
        isActive: true,
        calculation: textileCalculation(
          "TUL",
          "tul-main",
          4.5,
        ),
      },
      {
        productType: "FON",
        isActive: true,
        calculation: textileCalculation(
          "FON",
          "fon-main",
          3,
        ),
      },
    ],
    notes: "",
    photos: [],
    videos: [],
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  } as never;

function saleItemFixture(
  id: string,
  measurementId: string | undefined,
  productType: string,
): SaleItemFixture {
  return {
    id,
    measurementId,
    roomName: "Salon",
    windowName: "Açıklık 1",
    productType,
    productGroup: "PERDE",
    width: 100,
    height: 200,
    calcWidth: 100,
    calcHeight: 200,
    quantity: 1,
    metricSize: 1,
    metricUnit: "adet",
    unitPrice: 0,
    discount: 0,
    rowTotal: 0,
  } as SaleItemFixture;
}

function draftFixture(
  id: string,
  status: "TASLAK" | "ONAYLANDI" = "TASLAK",
): DraftSale {
  return {
    ...behaviorScope,
    id,
    saleNo: id,
    customerId: behaviorCustomer.id,
    status,
    items: [],
    priceSource: "MANUAL",
    totalAmount: 0,
    cashPrice: 0,
    installmentPrice: 0,
    discount: 0,
    downPayment: 0,
    remainingBalance: 0,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  } as unknown as DraftSale;
}

function memoryDraftStore(initialSales: DraftSale[]) {
  let currentSales = initialSales.map(sale => ({
    ...sale,
    items: [...sale.items],
  }));

  let addCount = 0;
  let updateCount = 0;

  const store = {
    get sales() {
      return currentSales;
    },
    addSale: async (sale: DraftSale) => {
      addCount += 1;
      currentSales = [
        ...currentSales,
        {
          ...sale,
          items: [...sale.items],
        },
      ];
    },
    updateSale: async (sale: DraftSale) => {
      updateCount += 1;
      currentSales = currentSales.map(current =>
        current.id === sale.id
          ? {
              ...sale,
              items: [...sale.items],
            }
          : current
      );
    },
  } as DraftStore;

  return {
    store,
    sales: () => currentSales,
    counts: () => ({
      add: addCount,
      update: updateCount,
    }),
  };
}

async function runBehaviorRegression() {
  const originalMeasurements =
    useMeasurementStore.getState().measurements;

  try {
    useMeasurementStore.setState({
      measurements: [selectedMeasurement],
    });

    const selectedOnly =
      createDraftSaleFromCustomer(
        behaviorCustomer,
        behaviorActor,
        behaviorScope,
        ["measurement-selection-v1"],
        undefined,
        [
          {
            measurementId: "measurement-selection-v1",
            productType: "TUL",
          },
        ],
      );

    assert.ok(
      selectedOnly.items.length > 0,
      "selected bundle must produce at least one sale item",
    );

    assert.ok(
      selectedOnly.items.every(item =>
        String(item.id).startsWith(
          "measurement-selection-v1-TUL-",
        )
      ),
      "only explicitly selected product bundle may be projected",
    );

    assert.equal(
      selectedOnly.items.some(item =>
        String(item.id).startsWith(
          "measurement-selection-v1-FON-",
        )
      ),
      false,
      "unselected product in the same measurement must not be transferred",
    );

    const target = draftFixture(
      "sale-selection-target-v1",
    );

    const manual = saleItemFixture(
      "manual-existing-v1",
      undefined,
      "AKSESUAR",
    );

    const unselectedAutomatic = saleItemFixture(
      "measurement-selection-v1-FON-sale-0",
      "measurement-selection-v1",
      "FON",
    );

    target.items = [
      manual,
      unselectedAutomatic,
    ];

    const memory =
      memoryDraftStore([target]);

    const returnedId =
      await syncOrCreateDraftSale(
        behaviorCustomer,
        memory.store,
        behaviorActor,
        behaviorScope,
        target.id,
        undefined,
        [
          {
            measurementId: "measurement-selection-v1",
            productType: "TUL",
          },
        ],
      );

    assert.equal(
      returnedId,
      target.id,
      "explicit transfer must continue the exact target sale",
    );

    const afterFirst =
      memory.sales().find(sale =>
        sale.id === target.id
      );

    assert.ok(
      afterFirst,
      "target draft must still exist after partial transfer",
    );

    assert.ok(
      afterFirst.items.some(item =>
        item.id === manual.id
      ),
      "manual existing row must be preserved",
    );

    assert.ok(
      afterFirst.items.some(item =>
        item.id === unselectedAutomatic.id
      ),
      "unselected automatic row must be preserved",
    );

    assert.ok(
      afterFirst.items.some(item =>
        saleItemContainsTransferBundleV1(
          item,
          {
            measurementId:
              "measurement-selection-v1",
            productType: "TUL",
          },
        )
      ),
      "selected bundle must be appended to existing draft",
    );

    const firstItemIds =
      afterFirst.items
        .map(item => item.id)
        .sort();

    await syncOrCreateDraftSale(
      behaviorCustomer,
      memory.store,
      behaviorActor,
      behaviorScope,
      target.id,
      undefined,
      [
        {
          measurementId:
            "measurement-selection-v1",
          productType: "TUL",
        },
      ],
    );

    const afterReplay =
      memory.sales().find(sale =>
        sale.id === target.id
      );

    assert.ok(afterReplay);

    assert.deepEqual(
      afterReplay.items
        .map(item => item.id)
        .sort(),
      firstItemIds,
      "replaying the same selected bundle must not create duplicate sale rows",
    );

    const countsAfterReplay =
      memory.counts();

    assert.equal(
      countsAfterReplay.add,
      0,
      "existing target transfer must not create a second draft",
    );

    assert.equal(
      countsAfterReplay.update,
      1,
      "duplicate replay must not rewrite the draft after the first append",
    );

    const emptySelectionTarget =
      draftFixture(
        "sale-empty-selection-v1",
      );

    const emptyMemory =
      memoryDraftStore([
        emptySelectionTarget,
      ]);

    await assert.rejects(
      () =>
        syncOrCreateDraftSale(
          behaviorCustomer,
          emptyMemory.store,
          behaviorActor,
          behaviorScope,
          emptySelectionTarget.id,
          undefined,
          [],
        ),
      /SALE_TRANSFER_SELECTION_REQUIRED/,
      "empty explicit transfer selection must fail closed",
    );

    assert.deepEqual(
      emptyMemory.counts(),
      {
        add: 0,
        update: 0,
      },
      "empty explicit selection must not mutate sale state",
    );

    const approved =
      draftFixture(
        "sale-approved-selection-v1",
        "ONAYLANDI",
      );

    approved.items = [
      saleItemFixture(
        "approved-existing-v1",
        "measurement-selection-v1",
        "FON",
      ),
    ];

    const approvedBefore =
      JSON.stringify(approved);

    const approvedMemory =
      memoryDraftStore([approved]);

    await assert.rejects(
      () =>
        syncOrCreateDraftSale(
          behaviorCustomer,
          approvedMemory.store,
          behaviorActor,
          behaviorScope,
          approved.id,
          undefined,
          [
            {
              measurementId:
                "measurement-selection-v1",
              productType: "TUL",
            },
          ],
        ),
      /TARGET_SALE_NOT_FOUND_OR_NOT_EDITABLE/,
      "approved/non-editable exact target must fail closed",
    );

    assert.deepEqual(
      approvedMemory.counts(),
      {
        add: 0,
        update: 0,
      },
      "approved target rejection must not mutate sale state",
    );

    assert.equal(
      JSON.stringify(
        approvedMemory.sales()[0],
      ),
      approvedBefore,
      "approved sale snapshot must remain unchanged",
    );
  } finally {
    useMeasurementStore.setState({
      measurements: originalMeasurements,
    });
  }
}

async function main() {
  await runBehaviorRegression();
  console.log("PAK: SALES_PREPARATION_SELECTION_GATE_V1");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
