export type MeasurementValidationStage =
  | "SOURCE_EXIT"
  | "CENTRAL_INBOUND";

export type MeasurementValidationDecision =
  | "VALID"
  | "REJECT"
  | "QUARANTINE";

export type MeasurementValidationIssueCode =
  | "OLC-CMP-001"
  | "OLC-CMP-002"
  | "OLC-VAL-001";

export interface MeasurementValidationIssue {
  code: MeasurementValidationIssueCode;
  message: string;
  severity: "ERROR";
  roomId?: string;
  roomName?: string;
  openingId?: string;
  openingName?: string;
  measurementId?: string;
}

export interface MeasurementValidationResult {
  valid: boolean;
  decision: MeasurementValidationDecision;
  issues: MeasurementValidationIssue[];
}

interface MeasurementLike {
  id?: string;
  templateType?: string;
  rawValues?: Record<string, unknown>;
  calculatedWidth?: number;
  calculatedHeight?: number;
}

interface OpeningLike {
  id?: string;
  name?: string;
  isDeleted?: boolean;
  products?: MeasurementLike[];
  measurements?: MeasurementLike[];
}

interface RoomLike {
  id?: string;
  name?: string;
  isDeleted?: boolean;
  windows?: OpeningLike[];
  openings?: OpeningLike[];
}

const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const positiveNumber = (value: unknown): boolean =>
  Number.isFinite(Number(value)) &&
  Number(value) > 0;

function finalize(
  stage: MeasurementValidationStage,
  issues: MeasurementValidationIssue[],
): MeasurementValidationResult {
  if (issues.length === 0) {
    return {
      valid: true,
      decision: "VALID",
      issues: [],
    };
  }

  return {
    valid: false,
    decision:
      stage === "SOURCE_EXIT"
        ? "REJECT"
        : "QUARANTINE",
    issues,
  };
}

export function validateMeasurementRecord(
  measurement: MeasurementLike,
  context?: {
    roomId?: string;
    roomName?: string;
    openingId?: string;
    openingName?: string;
  },
): MeasurementValidationIssue[] {
  const templateType = String(
    measurement.templateType || "",
  ).trim();

  if (
    templateType !== "CURTAIN_DETAIL" &&
    templateType !== "CURTAIN"
  ) {
    return [];
  }

  const rawValues = isRecord(
    measurement.rawValues,
  )
    ? measurement.rawValues
    : {};

  const facadeSegments = Array.isArray(
    rawValues.facadeSegments,
  )
    ? rawValues.facadeSegments
    : [];

  const hasFacadeWidth =
    facadeSegments.some(
      segment =>
        isRecord(segment) &&
        positiveNumber(segment.widthCm),
    ) ||
    positiveNumber(rawValues.windowWidth);

  if (hasFacadeWidth) {
    return [];
  }

  return [
    {
      code: "OLC-VAL-001",
      severity: "ERROR",
      message:
        "Detay Perde ölçüsünde en az bir geçerli cephe eni bulunmalıdır.",
      roomId: context?.roomId,
      roomName: context?.roomName,
      openingId: context?.openingId,
      openingName: context?.openingName,
      measurementId: measurement.id,
    },
  ];
}

export function validateMeasurementTransferTree(
  rooms: RoomLike[] | undefined,
  stage: MeasurementValidationStage,
): MeasurementValidationResult {
  const issues: MeasurementValidationIssue[] = [];

  const activeRooms = Array.isArray(rooms)
    ? rooms.filter(room => !room?.isDeleted)
    : [];

  for (const room of activeRooms) {
    const openings = [
      ...(
        Array.isArray(room.windows)
          ? room.windows
          : []
      ),
      ...(
        Array.isArray(room.openings)
          ? room.openings
          : []
      ),
    ].filter(opening => !opening?.isDeleted);

    if (openings.length === 0) {
      issues.push({
        code: "OLC-CMP-001",
        severity: "ERROR",
        message:
          `${room.name || "İsimsiz Oda"} odasında ölçü açıklığı bulunmuyor.`,
        roomId: room.id,
        roomName: room.name,
      });
      continue;
    }

    for (const opening of openings) {
      const measurements = [
        ...(
          Array.isArray(opening.measurements)
            ? opening.measurements
            : []
        ),
        ...(
          Array.isArray(opening.products)
            ? opening.products
            : []
        ),
      ];

      if (measurements.length === 0) {
        issues.push({
          code: "OLC-CMP-002",
          severity: "ERROR",
          message:
            `${room.name || "İsimsiz Oda"} > ${opening.name || "İsimsiz Açıklık"} için ölçü girilmemiş.`,
          roomId: room.id,
          roomName: room.name,
          openingId: opening.id,
          openingName: opening.name,
        });
        continue;
      }

      for (const measurement of measurements) {
        issues.push(
          ...validateMeasurementRecord(
            measurement,
            {
              roomId: room.id,
              roomName: room.name,
              openingId: opening.id,
              openingName: opening.name,
            },
          ),
        );
      }
    }
  }

  return finalize(stage, issues);
}