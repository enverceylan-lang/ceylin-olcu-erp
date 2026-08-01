import {
  validateMeasurementRecord,
  validateMeasurementTransferTree,
} from "../src/lib/measurementValidationEngine";

function assert(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sourceExitRejectsEmptyOpening(): void {
  const result =
    validateMeasurementTransferTree(
      [
        {
          id: "room-1",
          name: "Salon",
          windows: [
            {
              id: "opening-1",
              name: "Salon",
              products: [],
            },
          ],
        },
      ],
      "SOURCE_EXIT",
    );

  assert(
    result.decision === "REJECT",
    "Source exit must reject incomplete opening",
  );
  assert(
    result.issues.some(
      issue =>
        issue.code === "OLC-CMP-002",
    ),
    "Missing opening measurement issue expected",
  );

  console.log(
    "[PASS] sourceExitRejectsEmptyOpening",
  );
}

function centralInboundQuarantinesSameProblem(): void {
  const result =
    validateMeasurementTransferTree(
      [
        {
          id: "room-1",
          name: "Salon",
          windows: [
            {
              id: "opening-1",
              name: "Salon",
              products: [],
            },
          ],
        },
      ],
      "CENTRAL_INBOUND",
    );

  assert(
    result.decision === "QUARANTINE",
    "Central inbound must quarantine incomplete opening",
  );

  console.log(
    "[PASS] centralInboundQuarantinesSameProblem",
  );
}

function curtainDetailRequiresFacadeWidth(): void {
  const issues =
    validateMeasurementRecord(
      {
        id: "measurement-1",
        templateType: "CURTAIN_DETAIL",
        rawValues: {
          solYukseklikCm: 275,
          kaloriferMermerBoyuCm: 230,
          windowWidth: 0,
        },
      },
      {
        roomName: "Salon",
        openingName: "Salon",
      },
    );

  assert(
    issues.some(
      issue =>
        issue.code === "OLC-VAL-001",
    ),
    "CURTAIN_DETAIL without width must fail",
  );

  console.log(
    "[PASS] curtainDetailRequiresFacadeWidth",
  );
}

function curtainDetailAcceptsFacadeWidth(): void {
  const issues =
    validateMeasurementRecord({
      id: "measurement-2",
      templateType: "CURTAIN_DETAIL",
      rawValues: {
        solYukseklikCm: 275,
        facadeSegments: [
          {
            widthCm: 751,
          },
        ],
      },
    });

  assert(
    issues.length === 0,
    "CURTAIN_DETAIL with facade width and one height must pass",
  );

  console.log(
    "[PASS] curtainDetailAcceptsFacadeWidth",
  );
}

sourceExitRejectsEmptyOpening();
centralInboundQuarantinesSameProblem();
curtainDetailRequiresFacadeWidth();
curtainDetailAcceptsFacadeWidth();

console.log(
  "[PASS] measurementValidationEngineSuite completed",
);