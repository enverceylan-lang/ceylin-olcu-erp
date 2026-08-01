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
  | "OLC-VAL-001"
  | "OLC-VAL-002"
  | "OLC-VAL-003"
  | "OLC-VAL-004";

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
  isDeleted?: boolean;
  width?: number;
  height?: number;
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

interface CustomerTreeLike {
  rooms?: RoomLike[];
}

const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const positiveNumber = (value: unknown): boolean =>
  Number.isFinite(Number(value)) && Number(value) > 0;

function finalize(
  stage: MeasurementValidationStage,
  issues: MeasurementValidationIssue[],
): MeasurementValidationResult {
  if (issues.length === 0) {
    return { valid: true, decision: "VALID", issues: [] };
  }

  return {
    valid: false,
    decision: stage === "SOURCE_EXIT" ? "REJECT" : "QUARANTINE",
    issues,
  };
}

function hasCurtainWidth(
  rawValues: Record<string, unknown>,
): boolean {
  const facadeSegments = Array.isArray(rawValues.facadeSegments)
    ? rawValues.facadeSegments
    : [];

  return (
    facadeSegments.some(
      segment =>
        isRecord(segment) &&
        positiveNumber(segment.widthCm),
    ) ||
    positiveNumber(rawValues.windowWidth)
  );
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

  const rawValues = isRecord(
    measurement.rawValues,
  )
    ? measurement.rawValues
    : {};

  const issues: MeasurementValidationIssue[] = [];

  const pushWidthIssue = (): void => {
    issues.push({
      code: "OLC-VAL-003",
      severity: "ERROR",
      message:
        "Ölçünün kaydedilebilmesi için geçerli bir EN ölçüsü girilmelidir.",
      roomId: context?.roomId,
      roomName: context?.roomName,
      openingId: context?.openingId,
      openingName: context?.openingName,
      measurementId: measurement.id,
    });
  };

  const pushHeightIssue = (
    detail = false,
  ): void => {
    issues.push({
      code: "OLC-VAL-004",
      severity: "ERROR",
      message: detail
        ? "Detay ölçüde Sol Boy, Orta Boy, Sağ Boy veya Kalorifer / Mermer Boşluğu alanlarından en az biri girilmelidir."
        : "Ölçünün kaydedilebilmesi için geçerli bir BOY ölçüsü girilmelidir.",
      roomId: context?.roomId,
      roomName: context?.roomName,
      openingId: context?.openingId,
      openingName: context?.openingName,
      measurementId: measurement.id,
    });
  };

  if (
    templateType === "CURTAIN_DETAIL" ||
    templateType === "CURTAIN"
  ) {
    if (!hasCurtainWidth(rawValues)) {
      issues.push({
        code: "OLC-VAL-001",
        severity: "ERROR",
        message:
          "Detay ölçüde geçerli bir EN / cephe ölçüsü girilmelidir.",
        roomId: context?.roomId,
        roomName: context?.roomName,
        openingId: context?.openingId,
        openingName: context?.openingName,
        measurementId: measurement.id,
      });
    }

    const detailHeightKeys = [
      "solYukseklikCm",
      "ortaYukseklikCm",
      "sagYukseklikCm",
      "kaloriferMermerBoyuCm",
    ];

    const hasDetailHeight =
      detailHeightKeys.some(
        key => positiveNumber(rawValues[key]),
      ) ||
      (
        templateType === "CURTAIN" &&
        positiveNumber(rawValues.windowHeight)
      );

    if (!hasDetailHeight) {
      issues.push({
        code: "OLC-VAL-002",
        severity: "ERROR",
        message:
          "Detay ölçüde Sol Boy, Orta Boy, Sağ Boy veya Kalorifer / Mermer Boşluğu alanlarından en az biri girilmelidir.",
        roomId: context?.roomId,
        roomName: context?.roomName,
        openingId: context?.openingId,
        openingName: context?.openingName,
        measurementId: measurement.id,
      });
    }

    return issues;
  }

  if (
    templateType === "SIMPLE_WIDTH_HEIGHT" ||
    templateType === "mechanical_curtain"
  ) {
    if (!positiveNumber(rawValues.width)) {
      pushWidthIssue();
    }

    if (!positiveNumber(rawValues.height)) {
      pushHeightIssue();
    }

    return issues;
  }

  if (templateType === "PLICELL") {
    const plicellList = Array.isArray(
      rawValues.plicellCamListesi,
    )
      ? rawValues.plicellCamListesi.filter(isRecord)
      : [];

    if (plicellList.length > 0) {
      const commonHeight =
        positiveNumber(rawValues.ortakCamBoyuCm);

      const allWidthsValid =
        plicellList.every(
          glass => positiveNumber(glass.widthCm),
        );

      const allHeightsValid =
        commonHeight ||
        plicellList.every(
          glass => positiveNumber(glass.heightCm),
        );

      if (!allWidthsValid) {
        pushWidthIssue();
      }

      if (!allHeightsValid) {
        pushHeightIssue();
      }

      return issues;
    }

    if (!positiveNumber(rawValues.glassWidth)) {
      pushWidthIssue();
    }

    if (!positiveNumber(rawValues.glassHeight)) {
      pushHeightIssue();
    }

    return issues;
  }

  /*
   * Fail-closed fallback:
   * Yeni/legacy bir ölçü şablonu özel validator kazanana kadar
   * en ve boy olmadan operasyonel ölçü sayılamaz.
   */
  const genericWidth =
    positiveNumber(rawValues.width) ||
    positiveNumber(rawValues.glassWidth) ||
    positiveNumber(rawValues.windowWidth) ||
    positiveNumber(measurement.width) ||
    positiveNumber(measurement.calculatedWidth);

  const genericHeight =
    positiveNumber(rawValues.height) ||
    positiveNumber(rawValues.glassHeight) ||
    positiveNumber(rawValues.windowHeight) ||
    positiveNumber(measurement.height) ||
    positiveNumber(measurement.calculatedHeight);

  if (!genericWidth) {
    pushWidthIssue();
  }

  if (!genericHeight) {
    pushHeightIssue();
  }

  return issues;
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
      ...(Array.isArray(room.windows) ? room.windows : []),
      ...(Array.isArray(room.openings) ? room.openings : []),
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
        ...(Array.isArray(opening.measurements)
          ? opening.measurements
          : []),
        ...(Array.isArray(opening.products)
          ? opening.products
          : []),
      ].filter(measurement => !measurement?.isDeleted);

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
          ...validateMeasurementRecord(measurement, {
            roomId: room.id,
            roomName: room.name,
            openingId: opening.id,
            openingName: opening.name,
          }),
        );
      }
    }
  }

  return finalize(stage, issues);
}

export function validateCustomerMeasurementExit(
  customer: CustomerTreeLike,
  stage: MeasurementValidationStage = "SOURCE_EXIT",
): MeasurementValidationResult {
  const activeRooms = Array.isArray(customer?.rooms)
    ? customer.rooms.filter(room => !room?.isDeleted)
    : [];

  if (activeRooms.length === 0) {
    return finalize(stage, []);
  }

  return validateMeasurementTransferTree(activeRooms, stage);
}