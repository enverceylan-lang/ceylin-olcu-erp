import { Customer, Room, WindowItem, ProductMeasurement, Note, MEASUREMENT_TEMPLATES } from '@/store/useStore';
import { getTemplateLabel, getMeasurementDimensions } from './measurementAdapter';
import { formatFacadeForReport } from './facadeHelper';

// ─── Plicell Square Meter Calculation ───

/**
 * Rounds a value up to the next multiple of 10.
 * e.g., 30.60 -> 40, 47.50 -> 50, 48.00 -> 50, 50.10 -> 60, 50.00 -> 50
 */
export function roundUpToNext10(valueCm: number): number {
  if (valueCm <= 0) return 0;
  return Math.ceil(Number(valueCm.toFixed(2)) / 10) * 10;
}

/**
 * Calculates square meters for Plicell Blinds.
 * Round up width and height to next 10, multiply, divide by 10000.
 * Minimum chargeable area is 1.00 m².
 */
export function calculatePlicellM2(widthCm: number, heightCm: number) {
  const roundedWidth = roundUpToNext10(widthCm);
  const roundedHeight = roundUpToNext10(heightCm);
  const rawM2 = Number(((roundedWidth * roundedHeight) / 10000).toFixed(4));
  const chargeableM2 = Math.max(1.00, Number(rawM2.toFixed(2)));
  return {
    actualWidth: widthCm,
    actualHeight: heightCm,
    roundedWidth,
    roundedHeight,
    rawM2,
    chargeableM2
  };
}

/**
 * Calculates billing dimensions and square meters for Mechanical Curtain.
 * - If actual width < 100 cm, billing width = 100 cm.
 * - If actual width >= 100 cm, billing width is rounded up to next 10 cm.
 * - If actual height < 200 cm, billing height = 200 cm.
 * - If actual height >= 200 cm, billing height is rounded up to next 10 cm.
 * - Unit m2 = billingWidth * billingHeight / 10000
 * - Total m2 = Unit m2 * quantity
 */
export function calculateMechanicalCurtainM2(widthCm: number, heightCm: number, quantity: number = 1) {
  let billingWidth = 100;
  if (widthCm < 100) {
    billingWidth = 100;
  } else {
    billingWidth = roundUpToNext10(widthCm);
  }

  let billingHeight = 200;
  if (heightCm < 200) {
    billingHeight = 200;
  } else {
    billingHeight = roundUpToNext10(heightCm);
  }

  const unitM2 = Number(((billingWidth * billingHeight) / 10000).toFixed(4));
  const totalM2 = Number((unitM2 * quantity).toFixed(4));

  return {
    actualWidth: widthCm,
    actualHeight: heightCm,
    billingWidth,
    billingHeight,
    unitM2: Number(unitM2.toFixed(2)),
    totalM2: Number(totalM2.toFixed(2))
  };
}

// ─── WhatsApp Short Report Builder ───

export function buildWhatsAppShortReport(customer: Customer, users: { id: string; name: string }[]): string {
  const lines: string[] = [
    `*ÖLÇÜ ERP V1 - SAHA ÖLÇÜ RAPORU*`,
    `Müşteri: ${customer.name}`,
    `Telefon: ${customer.phone || '-'}`,
    `Adres: ${customer.address || customer.mapLocation || '-'}`,
    `Rapor Tarihi: ${new Date().toLocaleString('tr-TR')}`
  ];

  // 1. Determine "Ölçüyü Alan" (Person who took measurements)
  // Collect all unique names of personnel who took measurements
  const allMeasuredBy = new Set<string>();
  let hasMeasurements = false;
  customer.rooms?.forEach(room => {
    room.windows?.forEach(window => {
      window.products?.forEach(p => {
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
      window.products?.forEach(p => {
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
      const plicellItems = win.products?.filter(p => p.templateType === 'PLICELL') || [];
      const mechanicalItems = win.products?.filter(p => p.templateType === 'mechanical_curtain') || [];
      const standardItems = win.products?.filter(p => p.templateType !== 'PLICELL' && p.templateType !== 'mechanical_curtain') || [];

      if (plicellItems.length > 0) {
        plicellItems.forEach(item => {
          plicellProducts.push({ p: item, indexInRoom: ++plicellCounter, openingName: win.name });
        });
      }

      if (mechanicalItems.length > 0) {
        mechanicalItems.forEach(item => {
          mechanicalCurtainProducts.push({ p: item, indexInRoom: ++mechanicalCounter, openingName: win.name });
        });
      }

      if (standardItems.length > 0) {
        standardOpenings.push({ window: win, products: standardItems });
      }
    });

    // A. Render Standard Openings
    const showOpeningName = windows.length > 1; // only show opening names if there's more than 1 window/opening
    
    standardOpenings.forEach(({ window, products }, openingIndex) => {
      if (showOpeningName) {
        lines.push(`  [Açıklık: ${window.name}]`);
      }

      products.forEach((p, pIdx) => {
        lines.push(`  Ölçü ${pIdx + 1}: ${getTemplateLabel(p.templateType)}`);
        
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
        if (p.notes && p.notes.trim()) {
          lines.push(`  - Not: ${p.notes.trim()}`);
        }
      });
    });

    // B. Render Plicell Group (Kompakt Liste)
    if (plicellProducts.length > 0) {
      lines.push(`  Ölçü: Plicell Cam İçi Ölçüsü`);
      
      const notesList: string[] = [];
      let roomPlicellM2 = 0;

      plicellProducts.forEach(({ p, indexInRoom }) => {
        const w = Number(p.rawValues?.glassWidth || 0);
        const h = Number(p.rawValues?.glassHeight || 0);
        const calc = calculatePlicellM2(w, h);

        roomPlicellM2 += calc.chargeableM2;
        globalPlicellCount++;
        globalPlicellM2 += calc.chargeableM2;

        lines.push(`  ${indexInRoom}) ${w.toFixed(2)} en x ${h.toFixed(2)} boy → Hesap: ${calc.roundedWidth} x ${calc.roundedHeight} = ${calc.chargeableM2.toFixed(2)} m²`);
        
        // Collect notes if any
        if (p.notes && p.notes.trim()) {
          notesList.push(`  - ${indexInRoom}. Cam: ${p.notes.trim()}`);
        }
      });

      lines.push(`  Toplam: ${plicellProducts.length} Adet Cam - ${roomPlicellM2.toFixed(2)} m²`);

      if (notesList.length > 0) {
        lines.push(`  Notlar:`);
        notesList.forEach(nl => lines.push(nl));
      }
    }

    // C. Render Mechanical Curtain Group (Kompakt Liste)
    if (mechanicalCurtainProducts.length > 0) {
      lines.push(`  Ölçü: Mekanik Perde Ölçüsü`);
      
      const notesList: string[] = [];
      let roomMechanicalM2 = 0;

      mechanicalCurtainProducts.forEach(({ p, indexInRoom }) => {
        const w = Number(p.rawValues?.width || 0);
        const h = Number(p.rawValues?.height || 0);
        const q = Number(p.rawValues?.quantity || 1);
        const productType = p.rawValues?.productType || 'Stor Perde';
        const calc = calculateMechanicalCurtainM2(w, h, q);

        roomMechanicalM2 += calc.totalM2;
        globalMechanicalCount += q;
        globalMechanicalM2 += calc.totalM2;

        const qtySuffix = q > 1 ? ` x ${q} adet` : '';
        const m2Formula = q > 1 
          ? ` = ${calc.unitM2.toFixed(2)} m² x ${q} = ${calc.totalM2.toFixed(2)} m²` 
          : ` = ${calc.totalM2.toFixed(2)} m²`;

        lines.push(`  ${indexInRoom}) ${productType} — ${w} en x ${h} boy${qtySuffix} → Hesap: ${calc.billingWidth} x ${calc.billingHeight}${m2Formula}`);
        
        // Collect notes if any
        if (p.notes && p.notes.trim()) {
          notesList.push(`  - ${indexInRoom}. Mekanik: ${p.notes.trim()}`);
        }
      });

      const totalQuantity = mechanicalCurtainProducts.reduce((acc, curr) => acc + Number(curr.p.rawValues?.quantity || 1), 0);
      lines.push(`  Toplam: ${totalQuantity} Adet Mekanik Perde - ${roomMechanicalM2.toFixed(2)} m²`);

      if (notesList.length > 0) {
        lines.push(`  Notlar:`);
        notesList.forEach(nl => lines.push(nl));
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
  lines.push('Ölçü ERP V1.0 - Saha Pilot');

  return lines.join('\n');
}
