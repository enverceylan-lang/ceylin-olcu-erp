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

export function buildWhatsAppShortReport(customer: Customer, users: { id: string; name: string }[], measurements: MeasurementRecord[] = []): string {
  const lines: string[] = [
    `*CEYLİN ERP - SAHA ÖLÇÜ RAPORU*`,
    `Müşteri: ${customer.name}`,
    `Telefon: ${customer.phone || '-'}`,
    `Adres: ${customer.address || customer.mapLocation || '-'}`,
    `Rapor Tarihi: ${new Date().toLocaleString('tr-TR')}`
  ];

  // 1. Determine "Ölçüyü Alan" (Person who took measurements)
  // Collect all unique names of personnel who took measurements
  const allMeasuredBy = new Set<string>();
  let hasMeasurements = false;
  const allMeasurements = measurements.filter(m => m.customerId === customer.id && !m.isDeleted);
    customer.rooms?.forEach(room => {
      room.windows?.forEach(window => {
        allMeasurements.filter(m => m.windowId === window.id).forEach(p => {
        hasMeasurements = true;
        if (p.measuredBy) allMeasuredBy.add(p.measuredBy);
      });
    });
  });

  const sameMeasuredBy = allMeasuredBy.size === 1 ? Array.from(allMeasuredBy)[0] : null;
  if (sameMeasuredBy) {
    lines.push(`Ölçüyü Alan: ${sameMeasuredBy}`);
  }
  lines.push(''); // spacing

  if (!customer.rooms || customer.rooms.length === 0) {
    lines.push('Henüz oda ve ölçü kaydı bulunmuyor.');
    return lines.join('\n');
  }

  // 2. Date checks: are measurements on different days?
  const uniqueDays = new Set<string>();
  customer.rooms.forEach(room => {
      room.windows?.forEach(window => {
        allMeasurements.filter(m => m.windowId === window.id).forEach(p => {
        if (p.measuredDate) {
          const dayStr = new Date(p.measuredDate).toLocaleDateString('tr-TR');
          uniqueDays.add(dayStr);
        }
      });
    });
  });
  const showDateOnMeasurements = uniqueDays.size > 1;

  let globalPlicellCount = 0;
  let globalPlicellM2 = 0;
  let globalMechanicalCount = 0;
  let globalMechanicalM2 = 0;

  // 3. Process Rooms
  customer.rooms.forEach((room, roomIndex) => {
    lines.push(`*${roomIndex + 1}. ODA: ${room.name}*`);

    const windows = room.windows || [];
    if (windows.length === 0) {
      lines.push('- Oda altında açıklık kaydı yok.');
      lines.push('');
      return;
    }

    // Split windows into Plicell, Mechanical Curtain and standard for specialized layout
    // We group Plicell items and Mechanical Curtain items per room
    const plicellProducts: { p: ProductMeasurement; indexInRoom: number; openingName: string }[] = [];
    const mechanicalCurtainProducts: { p: ProductMeasurement; indexInRoom: number; openingName: string }[] = [];
    const standardOpenings: { window: WindowItem; products: ProductMeasurement[] }[] = [];

    let plicellCounter = 0;
    let mechanicalCounter = 0;
    windows.forEach((win) => {
      const winProds = allMeasurements.filter(m => m.windowId === win.id);
      winProds.forEach(m => {
        const activeProducts = m.selectedProducts?.filter(sp => sp.isActive) || [];

        if (activeProducts.length === 0) {
          // Fallback
          const fallbackGroup = resolveMeasurementProductGroup(m);
          if (fallbackGroup === 'Plicell') {
            plicellProducts.push({ p: m, indexInRoom: ++plicellCounter, openingName: win.name });
          } else if (fallbackGroup === 'Mekanik Perde') {
            mechanicalCurtainProducts.push({ p: m, indexInRoom: ++mechanicalCounter, openingName: win.name });
          } else {
            let entry = standardOpenings.find(so => so.window.id === win.id);
            if (!entry) {
              entry = { window: win, products: [] };
              standardOpenings.push(entry);
            }
            entry.products.push(m);
          }
        } else {
          activeProducts.forEach(ap => {
            const pType = ap.productType;
            const pGroup = resolveMeasurementProductGroup({ productType: pType });

            const pObj: ProductMeasurement = {
              ...m,
              productType: pType,
              productGroup: pGroup,
              selectedProducts: [ap],
              details: {
                ...m.details,
                ...ap.calculation
              }
            };

            if (pType === 'PLICELL') {
              plicellProducts.push({ p: pObj, indexInRoom: ++plicellCounter, openingName: win.name });
            } else if (pGroup === 'Mekanik Perde') {
              if (ap.calculation?.isSegmented && Array.isArray(ap.calculation.groups) && ap.calculation.groups.length > 0) {
                ap.calculation.groups.forEach((g: any, gIdx: number) => {
                  const gObj: ProductMeasurement = {
                    ...m,
                    id: `${m.id}-group-${gIdx}`,
                    productType: pType,
                    productGroup: pGroup,
                    selectedProducts: [ap],
                    rawValues: {
                      ...m.rawValues,
                      width: g.realWidthCm,
                      height: g.realHeightCm,
                      quantity: g.quantity
                    },
                    details: {
                      ...m.details,
                      ...ap.calculation,
                      billingWidth: g.calculatedWidthCm,
                      billingHeight: g.calculatedHeightCm,
                      totalM2: g.totalM2
                    }
                  };
                  mechanicalCurtainProducts.push({ p: gObj, indexInRoom: ++mechanicalCounter, openingName: `${win.name} - Parça ${gIdx + 1}` });
                });
              } else {
                mechanicalCurtainProducts.push({ p: pObj, indexInRoom: ++mechanicalCounter, openingName: win.name });
              }
            } else {
              let entry = standardOpenings.find(so => so.window.id === win.id);
              if (!entry) {
                entry = { window: win, products: [] };
                standardOpenings.push(entry);
              }
              entry.products.push(pObj);
            }
          });
        }
      });
    });

    // A. Render Standard Openings
    const showOpeningName = windows.length > 1; // only show opening names if there's more than 1 window/opening

    standardOpenings.forEach(({ window, products }, openingIndex) => {
      if (showOpeningName) {
        lines.push(`  [Açıklık: ${window.name}]`);
      }

      products.forEach((p, pIdx) => {
        lines.push(`  Ölçü ${pIdx + 1}: ${resolveMeasurementProductLabel(p)} (${getTemplateLabel(p.templateType)})`);

        // Render fields inline
        if (p.templateType === 'CURTAIN_DETAIL' || p.templateType === 'CURTAIN') {
          const dims = getMeasurementDimensions(p);
          const facadeSegments = p.rawValues?.facadeSegments;

          if (facadeSegments && Array.isArray(facadeSegments) && facadeSegments.length > 0) {
            lines.push(`  - ${formatFacadeForReport(facadeSegments).replace(/\n/g, '\n    ')}`);

            const totalWidth = facadeSegments.reduce((sum: number, s: any) => sum + (s.widthCm > 0 ? s.widthCm : 0), 0);
            lines.push(`  - Toplam En: ${totalWidth} cm`);

            // Heights summary
            const sol = p.rawValues?.solYukseklikCm;
            const orta = p.rawValues?.ortaYukseklikCm;
            const sag = p.rawValues?.sagYukseklikCm;
            const hFields = [];
            if (sol) hFields.push(`Sol ${sol}`);
            if (orta) hFields.push(`Orta ${orta}`);
            if (sag) hFields.push(`Sağ ${sag}`);
            if (hFields.length > 0) {
              lines.push(`  - Yükseklik Özeti: ${hFields.join(' / ')} cm`);
            }

            if (p.rawValues?.kartonpiyerBoslukCm && Number(p.rawValues.kartonpiyerBoslukCm) > 0) {
              lines.push(`  - KARTONPİYER BOŞLUĞU: ${p.rawValues.kartonpiyerBoslukCm} cm`);
            }
            if (p.rawValues?.camUstuCm && Number(p.rawValues.camUstuCm) > 0) {
              lines.push(`  - Cam Üstü: ${p.rawValues.camUstuCm} cm`);
            }
            if (p.rawValues?.camIciCm && Number(p.rawValues.camIciCm) > 0) {
              lines.push(`  - Cam İçi: ${p.rawValues.camIciCm} cm`);
            }
            if (p.rawValues?.kaloriferMermerBoyuCm && Number(p.rawValues.kaloriferMermerBoyuCm) > 0) {
              lines.push(`  - Kalorifer / Mermer: ${p.rawValues.kaloriferMermerBoyuCm} cm`);
            }
            if (p.rawValues?.camAltiCm && Number(p.rawValues.camAltiCm) > 0) {
              lines.push(`  - Cam Altı: ${p.rawValues.camAltiCm} cm`);
            }
            if (p.rawValues?.yukseklikNotu) {
              lines.push(`  - Yükseklik Notu: ${p.rawValues.yukseklikNotu}`);
            }
          } else {
            const leftWall = p.rawValues?.leftWall ?? '0';
            const windowWidth = p.rawValues?.windowWidth ?? '0';
            const rightWall = p.rawValues?.rightWall ?? '0';
            const ceilingGap = p.rawValues?.ceilingGap ?? '0';
            const windowHeight = p.rawValues?.windowHeight ?? '0';
            const floorGap = p.rawValues?.floorGap ?? '0';

            lines.push(`  - Sol Duvar (cm): ${leftWall}   - Pencere Eni (cm): ${windowWidth}   - Sağ Duvar (cm): ${rightWall}`);
            lines.push(`  - Tavan Boşluğu (cm): ${ceilingGap}   - Pencere Boyu (cm): ${windowHeight}   - Zemin Boşluğu (cm): ${floorGap}`);
            lines.push(`  - Toplam Ölçü: ${dims.structuralWidth} × ${dims.structuralHeight} cm`);
          }
        } else if (p.templateType === 'SIMPLE_WIDTH_HEIGHT') {
          const width = p.rawValues?.width ?? '0';
          const height = p.rawValues?.height ?? '0';
          lines.push(`  - En (cm): ${width}   - Boy (cm): ${height}`);
          lines.push(`  - Toplam Ölçü: ${width} × ${height} cm`);
        } else {
          // General fields fallback
          const template = MEASUREMENT_TEMPLATES[p.templateType];
          const fields = template?.fields || [];
          if (fields.length > 0) {
            const chunks: string[] = [];
            fields.forEach(f => {
              const val = p.rawValues?.[f.key] ?? '-';
              chunks.push(`- ${f.label}: ${val}`);
            });
            // Print chunks in lines of 2 or 3
            for (let i = 0; i < chunks.length; i += 2) {
              const line = chunks.slice(i, i + 2).join('   ');
              lines.push(`  ${line}`);
            }
          }
        }

        // Diagnostic / metadata details (conditional)
        if (!sameMeasuredBy && p.measuredBy) {
          lines.push(`  - Ölçüyü Alan: ${p.measuredBy}`);
        }
        if (showDateOnMeasurements && p.measuredDate) {
          lines.push(`  - Tarih: ${new Date(p.measuredDate).toLocaleDateString('tr-TR')}`);
        }
        const validNote = getValidNote(p.notes);
        if (validNote) {
          lines.push(`  - Not: ${validNote}`);
        }
      });
    });

    // B. Render Plicell Group (Kompakt Liste)
    if (plicellProducts.length > 0) {
      lines.push(`  Ölçü: PLICELL CAM İÇİ`);

      const notesList: string[] = [];
      let roomPlicellM2 = 0;
      let roomPlicellAdet = 0;

      plicellProducts.forEach(({ p, indexInRoom }) => {
        const storedCalculation =
          getStoredProductCalculation(
            p,
            'PLICELL'
          );

        const storedCams = Array.isArray(
          storedCalculation.cams
        )
          ? storedCalculation.cams
          : Array.isArray(
              storedCalculation.groups
            )
              ? storedCalculation.groups
              : [];

        const quantity = Math.max(
          1,
          Number(
            storedCalculation.quantity ??
            p.rawValues?.quantity ??
            1
          )
        );

        const totalM2 = Number(
          storedCalculation.totalSystemM2 ??
          storedCalculation.totalM2 ??
          0
        );

        const profilRengi =
          p.rawValues?.profilRengi;

        if (profilRengi) {
          lines.push(
            `  Profil Rengi: ${profilRengi}`
          );
        }

        const ortakBoy = Number(
          p.rawValues?.ortakCamBoyuCm || 0
        );

        if (ortakBoy > 0) {
          lines.push(
            `  Ortak Cam Boyu: ${ortakBoy} cm`
          );
        }

        if (storedCams.length === 0) {
          lines.push(
            `  ${indexInRoom}) Merkezi Plicell hesap sonucu bulunamadı.`
          );

          const validNote =
            getValidNote(p.notes);

          if (validNote) {
            notesList.push(
              `  - ${indexInRoom}. Cam: ${validNote}`
            );
          }

          return;
        }

        lines.push(
          `  Cam Adedi: ${storedCams.length * quantity}`
        );
        lines.push('');

        storedCams.forEach(
          (cam: any, camIndex: number) => {
            const realWidth = Number(
              cam.realWidthCm ??
              cam.actualWidthCm ??
              cam.widthCm ??
              0
            );

            const realHeight = Number(
              cam.realHeightCm ??
              cam.actualHeightCm ??
              cam.heightCm ??
              ortakBoy ??
              0
            );

            const billingWidth = Number(
              cam.billingWidthCm ??
              cam.calculatedWidthCm ??
              cam.roundedWidth ??
              0
            );

            const billingHeight = Number(
              cam.billingHeightCm ??
              cam.calculatedHeightCm ??
              cam.roundedHeight ??
              0
            );

            const camM2 = Number(
              cam.totalSystemM2 ??
              cam.totalM2 ??
              cam.chargeableM2 ??
              cam.unitM2 ??
              0
            );

            lines.push(
              `  ${camIndex + 1}. Cam: ${realWidth} × ${realHeight} cm → Hesap: ${billingWidth} × ${billingHeight} = ${camM2.toFixed(2)} m²`
            );

            const validCamNote =
              getValidNote(cam.note);

            if (validCamNote) {
              notesList.push(
                `  - ${camIndex + 1}. Cam Notu: ${validCamNote}`
              );
            }
          }
        );

        roomPlicellAdet +=
          storedCams.length * quantity;

        roomPlicellM2 += totalM2;
        globalPlicellCount +=
          storedCams.length * quantity;
        globalPlicellM2 += totalM2;
      });

      lines.push('');
      lines.push(
        `  Toplam Adet: ${roomPlicellAdet}`
      );
      lines.push(
        `  Toplam m²: ${roomPlicellM2.toFixed(2)}`
      );

      if (notesList.length > 0) {
        lines.push(`  Notlar:`);
        notesList.forEach(
          noteLine => lines.push(noteLine)
        );
      }
    }

    // C. Render Mechanical Curtain Group (Kompakt Liste)
    if (mechanicalCurtainProducts.length > 0) {
      lines.push(
        `  Ölçü: Mekanik Perde Ölçüsü`
      );

      const notesList: string[] = [];
      let roomMechanicalM2 = 0;
      let roomMechanicalCount = 0;

      mechanicalCurtainProducts.forEach(
        ({ p, indexInRoom, openingName }) => {
          const storedCalculation =
            getStoredProductCalculation(
              p,
              p.productType
            );

          const w = Number(
            storedCalculation.realWidthCm ??
            storedCalculation.actualWidthCm ??
            p.rawValues?.width ??
            0
          );

          const h = Number(
            storedCalculation.realHeightCm ??
            storedCalculation.actualHeightCm ??
            p.rawValues?.height ??
            0
          );

          const q = Math.max(
            1,
            Number(
              storedCalculation.quantity ??
              p.rawValues?.quantity ??
              1
            )
          );

          const productType =
            resolveMeasurementProductLabel(p);

          const calcWidth = Number(
            storedCalculation.billingWidthCm ??
            storedCalculation.calculatedWidthCm ??
            storedCalculation.billingWidth ??
            0
          );

          const calcHeight = Number(
            storedCalculation.billingHeightCm ??
            storedCalculation.calculatedHeightCm ??
            storedCalculation.billingHeight ??
            0
          );

          const unitM2 = Number(
            storedCalculation.unitM2 ??
            0
          );

          const totalM2 = Number(
            storedCalculation.totalSystemM2 ??
            storedCalculation.totalM2 ??
            0
          );

          roomMechanicalCount += q;
          roomMechanicalM2 += totalM2;
          globalMechanicalCount += q;
          globalMechanicalM2 += totalM2;

          const qtySuffix =
            q > 1
              ? ` x ${q} adet`
              : '';

          const m2Formula =
            q > 1
              ? ` = ${unitM2.toFixed(2)} m² x ${q} = ${totalM2.toFixed(2)} m²`
              : ` = ${totalM2.toFixed(2)} m²`;

          lines.push(
            `  ${indexInRoom}) [${openingName}] ${productType} — ${w} en x ${h} boy${qtySuffix} → Hesap: ${calcWidth} x ${calcHeight}${m2Formula}`
          );

          const validNote =
            getValidNote(p.notes);

          if (validNote) {
            notesList.push(
              `  - ${indexInRoom}. Mekanik: ${validNote}`
            );
          }
        }
      );

      lines.push(
        `  Toplam: ${roomMechanicalCount} Adet Mekanik Perde - ${roomMechanicalM2.toFixed(2)} m²`
      );

      if (notesList.length > 0) {
        lines.push(`  Notlar:`);
        notesList.forEach(
          noteLine => lines.push(noteLine)
        );
      }
    }

    lines.push(''); // spacing between rooms
  });

  // 4. Overall Plicell Grand Total
  if (globalPlicellCount > 0) {
    lines.push(`*GENEL PLİCELL TOPLAMI: ${globalPlicellCount} Adet Cam - ${globalPlicellM2.toFixed(2)} m²*`);
    lines.push('');
  }

  // 4.1. Overall Mechanical Curtain Grand Total
  if (globalMechanicalCount > 0) {
    lines.push(`*GENEL MEKANİK PERDE TOPLAMI: ${globalMechanicalCount} Adet Mekanik Perde - ${globalMechanicalM2.toFixed(2)} m²*`);
    lines.push('');
  }

  // 5. Footer with Google Maps URL and app signature
  const query = encodeURIComponent(customer.address || customer.mapLocation || '');
  const mapsUrl = customer.mapLocation || customer.address
    ? `https://www.google.com/maps/search/?api=1&query=${query}`
    : '';

  if (mapsUrl) {
    lines.push(`Konum: ${mapsUrl}`);
  }
  lines.push('CEYLİN ERP.0 - Saha Pilot');

  return lines.join('\n');
}
