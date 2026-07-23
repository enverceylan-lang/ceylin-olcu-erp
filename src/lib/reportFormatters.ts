import { MeasurementRecord } from '@/store/measurementStore';
import { Customer, Room, WindowItem, ProductMeasurement, Note, MEASUREMENT_TEMPLATES } from '@/store/useStore';
import { getTemplateLabel, getMeasurementDimensions, resolveMeasurementProductLabel, resolveMeasurementProductGroup } from './measurementAdapter';
import { formatFacadeForReport } from './facadeHelper';
import { getStoredProductCalculation } from './calculationEngine';

export function getValidNote(note?: string | null): string {
  if (!note) return "";
  const trimmed = note.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "not" || lower === "" || lower === "null" || lower === "undefined") {
    return "";
  }
  return trimmed;
}

// ─── WhatsApp Short Report Builder ───

export function buildWhatsAppShortReport(
  customer: Customer,
  users: { id: string; name: string }[],
  measurements: MeasurementRecord[] = [],
): string {
  void users;

  const lines: string[] = [
    '*CEYLİN PERDE — ÖLÇÜ RAPORU*',
    `Müşteri: ${customer.name}`,
    `Tarih: ${new Date().toLocaleDateString('tr-TR')}`,
    '',
  ];

  const customerMeasurements =
    measurements.filter(
      (measurement) =>
        measurement.customerId === customer.id &&
        !measurement.isDeleted,
    );

  const rooms = customer.rooms || [];

  if (
    rooms.length === 0 ||
    customerMeasurements.length === 0
  ) {
    lines.push(
      'Henüz kayıtlı ölçü bulunmuyor.',
    );

    return lines.join('\n');
  }

  const numberText = (
    value: unknown,
  ): string => {
    const number = Number(value || 0);

    return Number.isFinite(number)
      ? String(number)
      : '0';
  };

  const squareMeterText = (
    value: unknown,
  ): string => {
    const number = Number(value || 0);

    return number > 0
      ? ` — ${number.toFixed(2)} m²`
      : '';
  };

  const chainText = (
    value: any,
  ): string => {
    const direction =
      value?.chainDirection ??
      value?.zincirYonu ??
      value?.chainSide ??
      value?.controlSide;

    return direction
      ? ` — Zincir ${direction}`
      : '';
  };

  rooms.forEach((room) => {
    const roomLines: string[] = [];
    const windows = room.windows || [];
    const showOpening =
      windows.length > 1;

    windows.forEach((window) => {
      const openingMeasurements =
        customerMeasurements.filter(
          (measurement) =>
            measurement.windowId ===
            window.id,
        );

      openingMeasurements.forEach(
        (measurement) => {
          const activeProducts =
            measurement.selectedProducts
              ?.filter(
                (selectedProduct) =>
                  selectedProduct.isActive,
              ) || [];

          const products:
            ProductMeasurement[] =
              activeProducts.length > 0
                ? activeProducts.map(
                    (selectedProduct) => ({
                      ...measurement,
                      productType:
                        selectedProduct
                          .productType,
                      productGroup:
                        resolveMeasurementProductGroup(
                          {
                            productType:
                              selectedProduct
                                .productType,
                          },
                        ),
                      selectedProducts: [
                        selectedProduct,
                      ],
                      details: {
                        ...measurement.details,
                        ...selectedProduct
                          .calculation,
                      },
                    }),
                  )
                : [measurement];

          products.forEach((product) => {
            const productLabel =
              resolveMeasurementProductLabel(
                product,
              );

            const productGroup =
              resolveMeasurementProductGroup(
                product,
              );

            const openingPrefix =
              showOpening
                ? `${window.name} — `
                : '';

            const note = getValidNote(
              product.notes,
            );

            if (
              product.productType ===
              'PLICELL'
            ) {
              const calculation =
                getStoredProductCalculation(
                  product,
                  'PLICELL',
                );

              const cams = Array.isArray(
                calculation.cams,
              )
                ? calculation.cams
                : Array.isArray(
                    calculation.groups,
                  )
                  ? calculation.groups
                  : [];

              const commonHeight = Number(
                product.rawValues
                  ?.ortakCamBoyuCm || 0,
              );

              roomLines.push(
                `• ${openingPrefix}Plicell`,
              );

              const profileColor =
                product.rawValues
                  ?.profilRengi;

              if (profileColor) {
                roomLines.push(
                  `  Profil: ${profileColor}`,
                );
              }

              if (commonHeight > 0) {
                roomLines.push(
                  `  Ortak boy: ${commonHeight} cm`,
                );
              }

              if (cams.length === 0) {
                const width =
                  product.rawValues?.width ??
                  product.rawValues?.en ??
                  0;

                const height =
                  product.rawValues?.height ??
                  product.rawValues?.boy ??
                  commonHeight ??
                  0;

                roomLines.push(
                  `  Ölçü: ${numberText(width)} × ${numberText(height)} cm`,
                );
              }

              cams.forEach(
                (
                  cam: any,
                  camIndex: number,
                ) => {
                  const realWidth = Number(
                    cam.realWidthCm ??
                    cam.actualWidthCm ??
                    cam.widthCm ??
                    0,
                  );

                  const realHeight = Number(
                    cam.realHeightCm ??
                    cam.actualHeightCm ??
                    cam.heightCm ??
                    commonHeight ??
                    0,
                  );

                  const billingWidth =
                    Number(
                      cam.billingWidthCm ??
                      cam.calculatedWidthCm ??
                      cam.roundedWidth ??
                      0,
                    );

                  const billingHeight =
                    Number(
                      cam.billingHeightCm ??
                      cam.calculatedHeightCm ??
                      cam.roundedHeight ??
                      0,
                    );

                  const camM2 = Number(
                    cam.totalSystemM2 ??
                    cam.totalM2 ??
                    cam.chargeableM2 ??
                    cam.unitM2 ??
                    0,
                  );

                  let camLine =
                    `  ${camIndex + 1}. Cam: ${realWidth} × ${realHeight} cm`;

                  if (
                    billingWidth > 0 &&
                    billingHeight > 0 &&
                    (
                      billingWidth !==
                        realWidth ||
                      billingHeight !==
                        realHeight
                    )
                  ) {
                    camLine +=
                      ` — Hesap: ${billingWidth} × ${billingHeight}`;
                  }

                  camLine +=
                    squareMeterText(camM2);

                  roomLines.push(camLine);

                  const camNote =
                    getValidNote(cam.note);

                  if (camNote) {
                    roomLines.push(
                      `  Not: ${camNote}`,
                    );
                  }
                },
              );

              if (note) {
                roomLines.push(
                  `  Not: ${note}`,
                );
              }

              return;
            }

            if (
              productGroup ===
              'Mekanik Perde'
            ) {
              const calculation =
                getStoredProductCalculation(
                  product,
                  product.productType,
                );

              const groups = Array.isArray(
                calculation.groups,
              )
                ? calculation.groups
                : [];

              if (groups.length > 0) {
                groups.forEach(
                  (
                    group: any,
                    groupIndex: number,
                  ) => {
                    const partName =
                      group.label ??
                      group.name ??
                      group.partName ??
                      `Parça ${groupIndex + 1}`;

                    const realWidth = Number(
                      group.realWidthCm ??
                      group.actualWidthCm ??
                      group.widthCm ??
                      0,
                    );

                    const realHeight = Number(
                      group.realHeightCm ??
                      group.actualHeightCm ??
                      group.heightCm ??
                      0,
                    );

                    const billingWidth =
                      Number(
                        group.billingWidthCm ??
                        group.calculatedWidthCm ??
                        0,
                      );

                    const billingHeight =
                      Number(
                        group.billingHeightCm ??
                        group.calculatedHeightCm ??
                        0,
                      );

                    const totalM2 = Number(
                      group.totalSystemM2 ??
                      group.totalM2 ??
                      group.unitM2 ??
                      0,
                    );

                    let groupLine =
                      `• ${openingPrefix}${productLabel} — ${partName}: ${realWidth} × ${realHeight} cm`;

                    if (
                      billingWidth > 0 &&
                      billingHeight > 0 &&
                      (
                        billingWidth !==
                          realWidth ||
                        billingHeight !==
                          realHeight
                      )
                    ) {
                      groupLine +=
                        ` — Hesap: ${billingWidth} × ${billingHeight}`;
                    }

                    groupLine +=
                      squareMeterText(
                        totalM2,
                      );

                    groupLine +=
                      chainText(group);

                    roomLines.push(
                      groupLine,
                    );
                  },
                );
              } else {
                const realWidth = Number(
                  calculation.realWidthCm ??
                  calculation.actualWidthCm ??
                  product.rawValues?.width ??
                  0,
                );

                const realHeight = Number(
                  calculation.realHeightCm ??
                  calculation.actualHeightCm ??
                  product.rawValues?.height ??
                  0,
                );

                const billingWidth =
                  Number(
                    calculation.billingWidthCm ??
                    calculation.calculatedWidthCm ??
                    0,
                  );

                const billingHeight =
                  Number(
                    calculation.billingHeightCm ??
                    calculation.calculatedHeightCm ??
                    0,
                  );

                const totalM2 = Number(
                  calculation.totalSystemM2 ??
                  calculation.totalM2 ??
                  0,
                );

                let mechanicalLine =
                  `• ${openingPrefix}${productLabel}: ${realWidth} × ${realHeight} cm`;

                if (
                  billingWidth > 0 &&
                  billingHeight > 0 &&
                  (
                    billingWidth !==
                      realWidth ||
                    billingHeight !==
                      realHeight
                  )
                ) {
                  mechanicalLine +=
                    ` — Hesap: ${billingWidth} × ${billingHeight}`;
                }

                mechanicalLine +=
                  squareMeterText(totalM2);

                mechanicalLine +=
                  chainText(calculation);

                roomLines.push(
                  mechanicalLine,
                );
              }

              if (note) {
                roomLines.push(
                  `  Not: ${note}`,
                );
              }

              return;
            }

            if (
              product.templateType ===
                'CURTAIN_DETAIL' ||
              product.templateType ===
                'CURTAIN'
            ) {
              const facadeSegments =
                product.rawValues
                  ?.facadeSegments;

              roomLines.push(
                `• ${openingPrefix}${productLabel}`,
              );

              if (
                Array.isArray(
                  facadeSegments,
                ) &&
                facadeSegments.length > 0
              ) {
                const facadeText =
                  formatFacadeForReport(
                    facadeSegments,
                  )
                    .replace(
                      /\n+/g,
                      ' / ',
                    )
                    .replace(
                      /\s+/g,
                      ' ',
                    )
                    .trim();

                const totalWidth =
                  facadeSegments.reduce(
                    (
                      total: number,
                      segment: any,
                    ) =>
                      total +
                      (
                        Number(
                          segment.widthCm,
                        ) || 0
                      ),
                    0,
                  );

                roomLines.push(
                  `  Cephe: ${facadeText}`,
                );

                if (totalWidth > 0) {
                  roomLines.push(
                    `  Toplam en: ${totalWidth} cm`,
                  );
                }

                const heights:
                  string[] = [];

                if (
                  product.rawValues
                    ?.solYukseklikCm
                ) {
                  heights.push(
                    `Sol ${product.rawValues.solYukseklikCm}`,
                  );
                }

                if (
                  product.rawValues
                    ?.ortaYukseklikCm
                ) {
                  heights.push(
                    `Orta ${product.rawValues.ortaYukseklikCm}`,
                  );
                }

                if (
                  product.rawValues
                    ?.sagYukseklikCm
                ) {
                  heights.push(
                    `Sağ ${product.rawValues.sagYukseklikCm}`,
                  );
                }

                if (heights.length > 0) {
                  roomLines.push(
                    `  Boy: ${heights.join(' / ')} cm`,
                  );
                }
              } else {
                const dimensions =
                  getMeasurementDimensions(
                    product,
                  );

                roomLines.push(
                  `  Ölçü: ${dimensions.structuralWidth} × ${dimensions.structuralHeight} cm`,
                );
              }

              if (note) {
                roomLines.push(
                  `  Not: ${note}`,
                );
              }

              return;
            }

            const width =
              product.rawValues?.width ??
              product.rawValues?.en ??
              product.rawValues
                ?.windowWidth ??
              0;

            const height =
              product.rawValues?.height ??
              product.rawValues?.boy ??
              product.rawValues
                ?.windowHeight ??
              0;

            roomLines.push(
              `• ${openingPrefix}${productLabel}: ${numberText(width)} × ${numberText(height)} cm`,
            );

            if (note) {
              roomLines.push(
                `  Not: ${note}`,
              );
            }
          });
        },
      );
    });

    if (roomLines.length > 0) {
      lines.push(
        `*${room.name.toUpperCase()}*`,
        ...roomLines,
        '',
      );
    }
  });

  while (
    lines.length > 0 &&
    lines[lines.length - 1] === ''
  ) {
    lines.pop();
  }

  return lines.join('\n');
}
