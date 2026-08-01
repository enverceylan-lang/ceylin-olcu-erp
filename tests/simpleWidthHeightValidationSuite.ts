import {
  validateCustomerMeasurementExit,
  validateMeasurementRecord,
} from "../src/lib/measurementValidationEngine";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const widthOnly = validateMeasurementRecord({
  id: "simple-width-only",
  templateType: "SIMPLE_WIDTH_HEIGHT",
  rawValues: {
    width: 250,
    height: 0,
  },
});

assert(
  widthOnly.some(issue => issue.code === "OLC-VAL-004"),
  "Basit en-boy: en var, boy yok senaryosu reddedilmelidir.",
);
console.log("[PASS] simpleWidthWithoutHeightRejected");

const heightOnly = validateMeasurementRecord({
  id: "simple-height-only",
  templateType: "SIMPLE_WIDTH_HEIGHT",
  rawValues: {
    width: 0,
    height: 260,
  },
});

assert(
  heightOnly.some(issue => issue.code === "OLC-VAL-003"),
  "Basit en-boy: boy var, en yok senaryosu reddedilmelidir.",
);
console.log("[PASS] simpleHeightWithoutWidthRejected");

const valid = validateMeasurementRecord({
  id: "simple-valid",
  templateType: "SIMPLE_WIDTH_HEIGHT",
  rawValues: {
    width: 250,
    height: 260,
  },
});

assert(
  valid.length === 0,
  "Basit en-boy: en ve boy birlikte girilince geçmelidir.",
);
console.log("[PASS] simpleWidthAndHeightAccepted");

const customerWidthOnly = validateCustomerMeasurementExit(
  {
    rooms: [
      {
        id: "room-1",
        name: "Salon",
        windows: [
          {
            id: "opening-1",
            name: "Pencere",
            products: [
              {
                id: "simple-width-only",
                templateType: "SIMPLE_WIDTH_HEIGHT",
                rawValues: {
                  width: 250,
                  height: 0,
                },
              },
            ],
          },
        ],
      },
    ],
  },
  "SOURCE_EXIT",
);

assert(
  !customerWidthOnly.valid,
  "En var boy yok SIMPLE_WIDTH_HEIGHT CUSTOMER pasaportundan geçmemelidir.",
);
assert(
  customerWidthOnly.issues.some(issue => issue.code === "OLC-VAL-004"),
  "CUSTOMER pasaportunda eksik boy kodu bekleniyor.",
);
console.log("[PASS] simpleWidthOnlyRejectedAtCustomerPassport");

console.log("[PASS] simpleWidthHeightValidationSuite completed");