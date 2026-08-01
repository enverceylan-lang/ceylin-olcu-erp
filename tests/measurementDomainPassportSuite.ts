import {
  validateCustomerMeasurementExit,
  validateMeasurementRecord,
} from "../src/lib/measurementValidationEngine";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const noHeight = validateMeasurementRecord({
  id: "m1",
  templateType: "CURTAIN_DETAIL",
  rawValues: {
    facadeSegments: [{ widthCm: 350 }],
  },
});

assert(
  noHeight.some(issue => issue.code === "OLC-VAL-002"),
  "En var ama boy yoksa perde ölçüsü reddedilmeli",
);
console.log("[PASS] curtainWidthWithoutHeightRejected");

const withHeight = validateMeasurementRecord({
  id: "m2",
  templateType: "CURTAIN_DETAIL",
  rawValues: {
    facadeSegments: [{ widthCm: 350 }],
    solYukseklikCm: 275,
  },
});

assert(withHeight.length === 0, "En + bir boy geçerli olmalı");
console.log("[PASS] curtainWidthAndHeightAccepted");

const emptyRoom = validateCustomerMeasurementExit(
  {
    rooms: [
      {
        id: "r1",
        name: "Diyar",
        windows: [],
      },
    ],
  },
  "SOURCE_EXIT",
);

assert(!emptyRoom.valid, "Boş oda CUSTOMER çıkışından geçmemeli");
assert(
  emptyRoom.issues.some(issue => issue.code === "OLC-CMP-001"),
  "Boş oda kodu bekleniyor",
);
console.log("[PASS] emptyRoomRejectedAtCustomerPassport");

const emptyOpening = validateCustomerMeasurementExit(
  {
    rooms: [
      {
        id: "r1",
        name: "Salon",
        windows: [
          {
            id: "w1",
            name: "Pencere",
            products: [],
          },
        ],
      },
    ],
  },
  "SOURCE_EXIT",
);

assert(!emptyOpening.valid, "Ölçüsüz açıklık geçmemeli");
console.log("[PASS] emptyOpeningRejectedAtCustomerPassport");

const pureCustomer = validateCustomerMeasurementExit(
  { rooms: [] },
  "SOURCE_EXIT",
);

assert(pureCustomer.valid, "Saf cari kartı ölçü pasaportuna takılmamalı");
console.log("[PASS] pureCustomerCardAllowed");

console.log("[PASS] measurementDomainPassportSuite completed");