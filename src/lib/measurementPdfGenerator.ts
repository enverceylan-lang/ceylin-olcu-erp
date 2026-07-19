import jsPDF from 'jspdf';
import { Customer, ProductMeasurement, MEASUREMENT_TEMPLATES } from '@/store/useStore';
import { getTemplateLabel, getMeasurementDimensions, resolveMeasurementProductLabel, resolveMeasurementProductGroup } from '@/lib/measurementAdapter';
import { formatFacadeForReport } from '@/lib/facadeHelper';
import { getValidNote } from '@/lib/reportFormatters';
import { useMeasurementStore, MeasurementRecord } from '@/store/measurementStore';

// A4 Dimensions in mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;

function buildPdfCalculationSummary(
  productType: string,
  calculation: any
): string {
  const calc = calculation || {};
  const type = String(productType || '').toUpperCase();
  const parts: string[] = [];

  if (calc.systemType === 'DOUBLE') {
    parts.push('Ciftli Sistem');
  }

  if (
    calc.billingWidth !== undefined &&
    calc.billingHeight !== undefined
  ) {
    parts.push(
      `Hesap: ${calc.billingWidth}x${calc.billingHeight} cm`
    );
  } else if (
    calc.billingWidthCm !== undefined &&
    calc.billingHeightCm !== undefined
  ) {
    parts.push(
      `Hesap: ${calc.billingWidthCm}x${calc.billingHeightCm} cm`
    );
  }

  if (calc.totalM2 !== undefined) {
    parts.push(
      `Alan: ${Number(calc.totalM2).toFixed(2)} m2`
    );
  }

  if (calc.chainDirection === 'LEFT') {
    parts.push('Zincir: Sol');
  } else if (calc.chainDirection === 'RIGHT') {
    parts.push('Zincir: Sag');
  }

  if (
    type === 'DIKEY_STOR' ||
    type === 'DIKEY_TUL'
  ) {
    if (
      calc.productionWidth !== undefined &&
      calc.productionHeight !== undefined
    ) {
      parts.push(
        `Uretim: ${calc.productionWidth}x${calc.productionHeight} cm`
      );
    }

    if (calc.openingType === 'DOUBLE') {
      parts.push('Acilim: Ortadan Iki Yana');
    } else if (calc.openingType === 'SINGLE') {
      parts.push('Acilim: Tek');
    }
  }

  if (type === 'TUL') {
    if (calc.tulleStyle === 'REGISTER') {
      parts.push('Model: Register');
    } else if (calc.tulleStyle === 'CROSSOVER') {
      parts.push('Model: Kruvaze');
    } else if (calc.tulleStyle === 'PLEATED') {
      parts.push('Model: Pileli');
    }

    if (calc.pleatFactor !== undefined) {
      parts.push(`Pile: ${calc.pleatFactor}`);
    }

    if (calc.fabricUsageMeters !== undefined) {
      parts.push(
        `Kumas: ${Number(calc.fabricUsageMeters).toFixed(2)} m`
      );
    }
  }

  if (
    type === 'GUNESLIK' ||
    type === 'FON'
  ) {
    if (calc.fabricUsageMeters !== undefined) {
      parts.push(
        `Kumas: ${Number(calc.fabricUsageMeters).toFixed(2)} m`
      );
    }
  }

  if (
    calc.cutHeightCm !== undefined ||
    (
      (type === 'TUL' ||
       type === 'GUNESLIK' ||
       type === 'FON') &&
      calc.billingHeight !== undefined
    )
  ) {
    parts.push(
      `Kesim Boyu: ${
        calc.cutHeightCm ??
        calc.billingHeight
      } cm`
    );
  }

  if (
    Array.isArray(calc.salesItems) &&
    calc.salesItems.length > 1
  ) {
    parts.push(
      calc.salesItems
        .map((item: any) => item.label)
        .filter(Boolean)
        .join(' + ')
    );
  }

  return parts.join(' | ');
}
function drawSimpleTable(
  doc: jsPDF,
  startX: number,
  startY: number,
  head: string[],
  body: string[][]
): number {
  let y = startY;

  /*
   * Kullanılabilir A4 genişliği:
   * 210 - sol boşluk - sağ boşluk.
   *
   * Bu genişlikler toplam 176 mm'dir ve
   * MARGIN + 4 başlangıcında A4 içine sığar.
   */
  const colWidths = [
    27, // Açıklık
    23, // Ürün tipi
    14, // Gerçek en
    14, // Gerçek boy
    14, // Hesap en
    14, // Hesap boy
    9,  // Adet
    12, // Zincir
    13, // Birim m2
    13, // Toplam m2
    23  // Not
  ];

  const tableWidth =
    colWidths.reduce(
      (total, width) => total + width,
      0
    );

  const drawHeader = (): void => {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);

    doc.rect(
      startX,
      y,
      tableWidth,
      9,
      'FD'
    );

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);

    let currentX = startX;

    head.forEach((heading, index) => {
      const width = colWidths[index] || 15;

      const lines = doc.splitTextToSize(
        heading,
        Math.max(4, width - 2)
      );

      doc.text(
        lines.slice(0, 2),
        currentX + 1,
        y + 3.5
      );

      currentX += width;
    });

    y += 9;

    doc.setFont(
      'helvetica',
      'normal'
    );

    doc.setFontSize(6.5);
  };

  /*
   * Başlık ve ilk satır için yer yoksa
   * tabloyu yeni sayfadan başlat.
   */
  if (y > PAGE_HEIGHT - 30) {
    doc.addPage();
    y = MARGIN;
  }

  drawHeader();

  body.forEach((row) => {
    const preparedCells = row.map(
      (cell, index) => {
        const width =
          colWidths[index] || 15;

        return doc.splitTextToSize(
          String(cell ?? ''),
          Math.max(4, width - 2)
        );
      }
    );

    const maximumLineCount =
      Math.max(
        1,
        ...preparedCells.map(
          lines => lines.length
        )
      );

    const rowHeight =
      Math.max(
        8,
        maximumLineCount * 3.2 + 2
      );

    /*
     * Yeni satır sayfaya sığmıyorsa:
     * yeni sayfa + tablo başlığını tekrar çiz.
     */
    if (
      y + rowHeight >
      PAGE_HEIGHT - MARGIN
    ) {
      doc.addPage();
      y = MARGIN;
      drawHeader();
    }

    doc.setDrawColor(
      226,
      232,
      240
    );

    doc.rect(
      startX,
      y,
      tableWidth,
      rowHeight
    );

    let currentX = startX;

    preparedCells.forEach(
      (lines, index) => {
        const width =
          colWidths[index] || 15;

        /*
         * Sayısal kolonları sağa,
         * adet kolonunu ortaya hizala.
         */
        const isNumericColumn =
          index >= 2 &&
          index <= 9 &&
          index !== 7;

        const isQuantityColumn =
          index === 6;

        if (isQuantityColumn) {
          doc.text(
            lines,
            currentX + width / 2,
            y + 4,
            {
              align: 'center'
            }
          );
        } else if (isNumericColumn) {
          doc.text(
            lines,
            currentX + width - 1,
            y + 4,
            {
              align: 'right'
            }
          );
        } else {
          doc.text(
            lines,
            currentX + 1,
            y + 4
          );
        }

        currentX += width;
      }
    );

    y += rowHeight;
  });

  return y;
}
/**
 * Draws the curtain diagram via jsPDF primitives.
 */
function drawCurtainDetailDiagram(doc: jsPDF, x: number, y: number, rawValues: any) {
  const leftWall = Number(rawValues.leftWall || 0);
  const windowWidth = Number(rawValues.windowWidth || 0);
  const rightWall = Number(rawValues.rightWall || 0);
  const ceilingGap = Number(rawValues.ceilingGap || 0);
  const windowHeight = Number(rawValues.windowHeight || 0);
  const floorGap = Number(rawValues.floorGap || 0);

  const totalWidth = leftWall + windowWidth + rightWall;
  const totalHeight = ceilingGap + windowHeight + floorGap;

  const wallW = 80;
  const wallH = 60;

  let wPct = totalWidth > 0 ? windowWidth / totalWidth : 0.6;
  let lPct = totalWidth > 0 ? leftWall / totalWidth : 0.2;
  let rPct = totalWidth > 0 ? rightWall / totalWidth : 0.2;

  let hPct = totalHeight > 0 ? windowHeight / totalHeight : 0.6;
  let tPct = totalHeight > 0 ? ceilingGap / totalHeight : 0.2;
  let bPct = totalHeight > 0 ? floorGap / totalHeight : 0.2;

  if (wPct < 0.35) {
    const diff = 0.35 - wPct;
    wPct = 0.35;
    lPct = Math.max(0, lPct - diff/2);
    rPct = Math.max(0, rPct - diff/2);
  }
  if (hPct < 0.35) {
    const diff = 0.35 - hPct;
    hPct = 0.35;
    tPct = Math.max(0, tPct - diff/2);
    bPct = Math.max(0, bPct - diff/2);
  }

  const winX = x + (lPct * wallW);
  const winY = y + (tPct * wallH);
  const winW = wPct * wallW;
  const winH = hPct * wallH;

  doc.setDrawColor(100, 116, 139); // slate-500
  doc.setLineWidth(0.5);
  doc.rect(x, y, wallW, wallH);

  doc.setDrawColor(37, 99, 235); // blue-600
  doc.setLineWidth(1);
  doc.rect(winX, winY, winW, winH);

  // Center divider
  doc.setLineDashPattern([2, 2], 0);
  doc.line(winX + winW/2, winY, winX + winW/2, winY + winH);
  doc.setLineDashPattern([], 0); // reset

  doc.setFontSize(8);
  doc.setTextColor(220, 38, 38); // red-600
  doc.text(`${leftWall} cm`, x + (winX - x)/2, winY + winH/2, { align: 'center' });
  doc.text(`${rightWall} cm`, winX + winW + (x + wallW - (winX + winW))/2, winY + winH/2, { align: 'center' });

  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text(`${ceilingGap} cm`, winX + winW/2, y + (winY - y)/2, { align: 'center' });
  doc.text(`${floorGap} cm`, winX + winW/2, winY + winH + (y + wallH - (winY + winH))/2, { align: 'center' });

  doc.setTextColor(37, 99, 235); // blue-600
  doc.setFont('helvetica', 'bold');
  doc.text(`${windowWidth}x${windowHeight}`, winX + winW/2, winY - 2, { align: 'center' });

  return wallH;
}

function drawFacadeSegmentsDiagram(
  doc: jsPDF,
  x: number,
  y: number,
  rawValues: any
) {
  const segments =
    Array.isArray(rawValues.facadeSegments)
      ? rawValues.facadeSegments
      : [];

  if (segments.length === 0) {
    return 40;
  }

  const totalWidth = segments.reduce(
    (sum: number, segment: any) =>
      sum + Math.max(
        0,
        Number(segment.widthCm || 0)
      ),
    0
  );

  const karton =
    Number(rawValues.kartonpiyerBoslukCm || 0);

  const camUstu =
    Number(rawValues.camUstuCm || 0);

  const camIci =
    Number(rawValues.camIciCm || 0);

  const kaloriferMermer =
    Number(rawValues.kaloriferMermerBoyuCm || 0);

  const camAlti =
    Number(rawValues.camAltiCm || 0);

  const sol =
    Number(rawValues.solYukseklikCm || 0);

  const orta =
    Number(rawValues.ortaYukseklikCm || 0);

  const sag =
    Number(rawValues.sagYukseklikCm || 0);

  /*
   * Sağ kolonda kullanılabilir alan yaklaşık 100 mm.
   * Çizimi ve bütün notları bu alanın içinde tutuyoruz.
   */
  const drawW = 96;
  const segH = 17;

  let currentY = y + 4;

  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');

  doc.text(
    `${totalWidth} EN`,
    x + drawW / 2,
    currentY,
    { align: 'center' }
  );

  currentY += 3;

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);

  doc.rect(
    x,
    currentY,
    drawW,
    segH
  );

  let currentX = x;
  let consumedWidth = 0;

  segments.forEach(
    (segment: any, index: number) => {
      const numericWidth =
        Math.max(
          0,
          Number(segment.widthCm || 0)
        );

      const remainingWidth =
        drawW - consumedWidth;

      const proportionalWidth =
        totalWidth > 0
          ? (numericWidth / totalWidth) * drawW
          : drawW / segments.length;

      /*
       * Son segment kalan alanı tamamen kullanır.
       * Böylece min-width nedeniyle çizim sağa taşmaz.
       */
      const segmentDrawWidth =
        index === segments.length - 1
          ? remainingWidth
          : Math.min(
              remainingWidth,
              Math.max(6, proportionalWidth)
            );

      if (index > 0) {
        doc.setLineDashPattern([1, 1], 0);
        doc.line(
          currentX,
          currentY,
          currentX,
          currentY + segH
        );
        doc.setLineDashPattern([], 0);
      }

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');

      doc.text(
        String(numericWidth),
        currentX + segmentDrawWidth / 2,
        currentY + 6,
        { align: 'center' }
      );

      const rawLabel =
        String(
          segment.label ||
          segment.type ||
          ''
        );

      const shortLabel =
        rawLabel.length > 6
          ? `${rawLabel.substring(0, 3).toUpperCase()}.`
          : rawLabel.toUpperCase();

      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');

      doc.text(
        shortLabel,
        currentX + segmentDrawWidth / 2,
        currentY + 12,
        {
          align: 'center',
          maxWidth: Math.max(
            4,
            segmentDrawWidth - 1
          )
        }
      );

      currentX += segmentDrawWidth;
      consumedWidth += segmentDrawWidth;
    }
  );

  currentY += segH + 5;

  const heightParts: string[] = [];

  if (sol > 0) {
    heightParts.push(`${sol} SOL YUKS.`);
  }

  if (orta > 0) {
    heightParts.push(`${orta} ORTA YUKS.`);
  }

  if (sag > 0) {
    heightParts.push(`${sag} SAG YUKS.`);
  }

  if (heightParts.length > 0) {
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);

    const heightLines =
      doc.splitTextToSize(
        heightParts.join('   '),
        drawW
      );

    doc.text(
      heightLines,
      x,
      currentY
    );

    currentY +=
      heightLines.length * 3.2 + 2;
  }

  const detailParts: string[] = [];

  if (karton > 0) {
    detailParts.push(
      `KARTONPIYER: ${karton}`
    );
  }

  if (camUstu > 0) {
    detailParts.push(
      `CAM USTU: ${camUstu}`
    );
  }

  if (camIci > 0) {
    detailParts.push(
      `CAM ICI: ${camIci}`
    );
  }

  if (kaloriferMermer > 0) {
    detailParts.push(
      `KALORIFER/MERMER: ${kaloriferMermer}`
    );
  }

  if (camAlti > 0) {
    detailParts.push(
      `CAM ALTI: ${camAlti}`
    );
  }

  if (detailParts.length > 0) {
    doc.setDrawColor(203, 213, 225);

    doc.line(
      x,
      currentY,
      x + drawW,
      currentY
    );

    currentY += 3;

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    /*
     * Bilgileri iki kolon halinde çizimin altına yerleştir.
     */
    const columnWidth = drawW / 2;

    detailParts.forEach(
      (detail, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);

        doc.text(
          detail,
          x + column * columnWidth,
          currentY + row * 4,
          {
            maxWidth: columnWidth - 2
          }
        );
      }
    );

    currentY +=
      Math.ceil(detailParts.length / 2) * 4 +
      2;
  }

  return Math.max(
    45,
    currentY - y
  );
}
function drawSimpleDiagram(doc: jsPDF, x: number, y: number, width: number, height: number) {
  const wallW = 80;
  const wallH = 60;

  const winX = x + 15;
  const winY = y + 10;
  const winW = 50;
  const winH = 40;

  doc.setDrawColor(148, 163, 184); // slate-400
  doc.setLineWidth(0.5);
  doc.setLineDashPattern([2, 2], 0);
  doc.rect(x+5, y+5, 70, 50);
  doc.setLineDashPattern([], 0);

  doc.setDrawColor(37, 99, 235); // blue-600
  doc.setLineWidth(1);
  doc.rect(winX, winY, winW, winH);

  // Center divider
  doc.setLineDashPattern([2, 2], 0);
  doc.line(winX + winW/2, winY, winX + winW/2, winY + winH);
  doc.setLineDashPattern([], 0);

  doc.setFontSize(8);
  doc.setTextColor(220, 38, 38); // red-600
  doc.text(`${width} cm`, winX + winW/2, winY - 2, { align: 'center' });

  doc.setTextColor(16, 185, 129); // emerald-500
  doc.text(`${height} cm`, winX + winW + 4, winY + winH/2);

  return wallH;
}

export async function generateMeasurementPdfBlob(
  customer: Customer,
  sameMeasuredBy: string | null,
  measurements?: MeasurementRecord[]
): Promise<File> {
  const doc = new jsPDF('p', 'mm', 'a4');

  // Add Unicode font for Turkish chars (using standard helvetica fallback for basic usage,
  // but if you have a custom font, it should be registered. jsPDF standard fonts don't fully support all TR chars.
  // We'll use standard and replace unsupported if needed, but jsPDF helvetica supports ISO-8859-1 which covers some.
  // Actually, we'll just proceed with standard font as it's the safest without loading TTF files.

  let y = MARGIN;

  // Header
  doc.setFontSize(18);
  doc.setTextColor(37, 99, 235); // blue-600
  doc.setFont('helvetica', 'bold');
  doc.text('CEYLIN ERP', PAGE_WIDTH / 2, y, { align: 'center' });

  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Saha Olcu Raporu', PAGE_WIDTH / 2, y, { align: 'center' });

  y += 10;
  doc.setDrawColor(203, 213, 225);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 6;

  // Customer Info
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');

  const sanitize = (str: string) => str.replace(/Ä°/g, 'I').replace(/Ä±/g, 'i').replace(/Å/g, 'S').replace(/ÅŸ/g, 's').replace(/Ä/g, 'G').replace(/ÄŸ/g, 'g').replace(/Ãœ/g, 'U').replace(/Ã¼/g, 'u').replace(/Ã–/g, 'O').replace(/Ã¶/g, 'o').replace(/Ã‡/g, 'C').replace(/Ã§/g, 'c');

  doc.text(`Musteri: ${sanitize(customer.name)}`, MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, PAGE_WIDTH - MARGIN, y, { align: 'right' });

  y += 6;
  doc.text(`Telefon: ${customer.phone || '-'}`, MARGIN, y);
  if (sameMeasuredBy) {
    doc.text(`Olcuyu Alan: ${sanitize(sameMeasuredBy)}`, PAGE_WIDTH - MARGIN, y, { align: 'right' });
  }

  y += 6;
  doc.text(`Adres: ${sanitize(customer.address || customer.mapLocation || '-')}`, MARGIN, y);

  y += 10;
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 10;

  // Rooms
  if (!customer.rooms || customer.rooms.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.text('Oda ve olcu kaydi bulunmuyor.', PAGE_WIDTH/2, y, { align: 'center' });
  } else {
    let resolvedMeasurements: MeasurementRecord[] = measurements || [];
    if (!measurements) {
      const storeMeas = useMeasurementStore.getState().measurements;
      if (storeMeas && storeMeas.length > 0) {
        resolvedMeasurements = storeMeas;
      } else {
        const nested: MeasurementRecord[] = [];
        customer.rooms?.forEach(room => {
          room.windows?.forEach(win => {
            win.products?.forEach(p => {
              nested.push({
                ...p,
                customerId: customer.id,
                roomId: room.id,
                windowId: win.id
              } as any);
            });
          });
        });
        resolvedMeasurements = nested;
      }
    }
    customer.rooms.forEach((room, roomIdx) => {
      // Check page break
      if (y > PAGE_HEIGHT - 30) {
        doc.addPage();
        y = MARGIN;
      }

      const plicellProducts: { p: ProductMeasurement; index: number; winName: string }[] = [];
      const mechanicalProducts: { p: ProductMeasurement; index: number; winName: string }[] = [];
      const standardOpenings: { winName: string; winItem: any; products: ProductMeasurement[] }[] = [];

      (room.windows || []).forEach(win => {
        const winMeasurements = resolvedMeasurements.filter(m => m.windowId === win.id && m.customerId === customer.id && !m.isDeleted && !m.isArchived);
        winMeasurements.forEach(m => {
          const activeProducts = m.selectedProducts?.filter(sp => sp.isActive) || [];

          if (activeProducts.length === 0) {
            // Fallback
            const fallbackGroup = resolveMeasurementProductGroup(m);
            if (fallbackGroup === 'Plicell') {
              plicellProducts.push({ p: m, index: plicellProducts.length, winName: win.name });
            } else if (fallbackGroup === 'Mekanik Perde') {
              mechanicalProducts.push({ p: m, index: mechanicalProducts.length, winName: win.name });
            } else {
              let entry = standardOpenings.find(so => so.winName === win.name);
              if (!entry) {
                entry = { winName: win.name, winItem: win, products: [] };
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
                plicellProducts.push({ p: pObj, index: plicellProducts.length, winName: win.name });
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
                        totalM2: g.totalM2,
                        chainDirection: g.chainDirection
                      }
                    };
                    mechanicalProducts.push({ p: gObj, index: mechanicalProducts.length, winName: `${win.name} - ParÃ§a ${gIdx + 1}` });
                  });
                } else {
                  mechanicalProducts.push({ p: pObj, index: mechanicalProducts.length, winName: win.name });
                }
              } else {
                let entry = standardOpenings.find(so => so.winName === win.name);
                if (!entry) {
                  entry = { winName: win.name, winItem: win, products: [] };
                  standardOpenings.push(entry);
                }
                entry.products.push(pObj);
              }
            });
          }
        });
      });

      const hasAnyProducts = plicellProducts.length > 0 || mechanicalProducts.length > 0 || standardOpenings.length > 0;

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(`${roomIdx + 1}. ODA: ${sanitize(room.name)}`, MARGIN, y);
      y += 8;

      if (!hasAnyProducts) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 116, 139);
        doc.text('Bu oda icin olcu detayi yok.', MARGIN + 4, y);
        y += 10;
        return; // continue to next room
      }

      // Render Standard Openings (Curtain detail, Simple Width Height, etc)
      standardOpenings.forEach(({ winName, products }) => {
        if (y > PAGE_HEIGHT - 40) { doc.addPage(); y = MARGIN; }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(`[Aciklik: ${sanitize(winName)}]`, MARGIN + 4, y);
        y += 6;

        products.forEach((p, pIdx) => {
          if (y > PAGE_HEIGHT - 60) { doc.addPage(); y = MARGIN; }

          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          const validNote =
            getValidNote(p.notes);

          const hasFacadeSegments =
            Array.isArray(
              p.rawValues?.facadeSegments
            ) &&
            p.rawValues.facadeSegments.length > 0;

          /*
           * Segmentli cephede çizim + yükseklikler +
           * kartonpiyer/cam bilgileri daha fazla alan ister.
           */
          const boxHeight =
            hasFacadeSegments
              ? validNote
                ? 88
                : 78
              : validNote
                ? 65
                : 55;
          doc.rect(MARGIN + 4, y, PAGE_WIDTH - MARGIN*2 - 4, boxHeight, 'FD');

          let innerY = y + 6;
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'bold');
          doc.text(`Olcu ${pIdx + 1}: ${sanitize(resolveMeasurementProductLabel(p))} (${sanitize(getTemplateLabel(p.templateType))})`, MARGIN + 8, innerY);

          const dims = getMeasurementDimensions(p);
          const isCurtain = p.templateType === 'CURTAIN_DETAIL' || p.templateType === 'CURTAIN';
          const isSimple = p.templateType === 'SIMPLE_WIDTH_HEIGHT';

          innerY += 6;

          const calculationSummary =
            buildPdfCalculationSummary(
              String(p.productType || ''),
              p.details || {}
            );

          if (calculationSummary) {
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(37, 99, 235);

            const calculationLines =
              doc.splitTextToSize(
                calculationSummary,
                165
              );

            doc.text(
              calculationLines,
              MARGIN + 8,
              innerY
            );

            innerY +=
              calculationLines.length * 4 + 3;
          }

          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(15, 23, 42);

          const rightColX = MARGIN + 80;

          if (isCurtain) {
            const facadeSegments = p.rawValues?.facadeSegments;
            if (facadeSegments && Array.isArray(facadeSegments) && facadeSegments.length > 0) {
              const facadeStr = formatFacadeForReport(facadeSegments).replace(/Ã§/g, 'c').replace(/ÅŸ/g, 's').replace(/ÄŸ/g, 'g').replace(/Ä±/g, 'i').replace(/Ã¶/g, 'o').replace(/Ã¼/g, 'u').replace(/Ã‡/g, 'C').replace(/Å/g, 'S').replace(/Ä/g, 'G').replace(/Ä°/g, 'I').replace(/Ã–/g, 'O').replace(/Ãœ/g, 'U');
              const linesStr = doc.splitTextToSize(facadeStr, 65);
              doc.text(linesStr, MARGIN + 8, innerY);

              let curY = innerY + (linesStr.length * 4) + 4;
              if (p.rawValues?.kartonpiyerBoslukCm) { doc.text(`Kartonpiyer: ${p.rawValues.kartonpiyerBoslukCm}`, MARGIN + 8, curY); curY+=4; }
              if (p.rawValues?.camUstuCm) { doc.text(`Cam Ustu: ${p.rawValues.camUstuCm}`, MARGIN + 8, curY); curY+=4; }
              if (p.rawValues?.camIciCm) { doc.text(`Cam Ici: ${p.rawValues.camIciCm}`, MARGIN + 8, curY); curY+=4; }
              if (p.rawValues?.kaloriferMermerBoyuCm) { doc.text(`Kalorifer / Mermer: ${p.rawValues.kaloriferMermerBoyuCm}`, MARGIN + 8, curY); curY+=4; }
              if (p.rawValues?.camAltiCm) { doc.text(`Cam Alti: ${p.rawValues.camAltiCm}`, MARGIN + 8, curY); curY+=4; }
              if (p.rawValues?.solYukseklikCm) { doc.text(`Sol Yukseklik: ${p.rawValues.solYukseklikCm}`, MARGIN + 8, curY); curY+=4; }
              if (p.rawValues?.ortaYukseklikCm) { doc.text(`Orta Yukseklik: ${p.rawValues.ortaYukseklikCm}`, MARGIN + 8, curY); curY+=4; }
              if (p.rawValues?.sagYukseklikCm) { doc.text(`Sag Yukseklik: ${p.rawValues.sagYukseklikCm}`, MARGIN + 8, curY); curY+=4; }
              if (p.rawValues?.yukseklikNotu) { doc.text(`Yukseklik Notu: ${p.rawValues.yukseklikNotu}`, MARGIN + 8, curY); curY+=4; }

              // Draw Diagram
              drawFacadeSegmentsDiagram(doc, rightColX, innerY - 4, p.rawValues);
            } else {
              doc.text(`Sol Duvar: ${p.rawValues?.leftWall || 0} cm`, MARGIN + 8, innerY);
              doc.text(`Pencere Eni: ${p.rawValues?.windowWidth || 0} cm`, MARGIN + 8, innerY + 6);
              doc.text(`Sag Duvar: ${p.rawValues?.rightWall || 0} cm`, MARGIN + 8, innerY + 12);
              doc.text(`Tavan Boslugu: ${p.rawValues?.ceilingGap || 0} cm`, MARGIN + 8, innerY + 18);
              doc.text(`Pencere Boyu: ${p.rawValues?.windowHeight || 0} cm`, MARGIN + 8, innerY + 24);
              doc.text(`Zemin Boslugu: ${p.rawValues?.floorGap || 0} cm`, MARGIN + 8, innerY + 30);

              doc.setFont('helvetica', 'bold');
              doc.setTextColor(37, 99, 235);
              doc.text(`Toplam: ${dims.structuralWidth} x ${dims.structuralHeight} cm`, MARGIN + 8, innerY + 38);

              // Draw Diagram
              drawCurtainDetailDiagram(doc, rightColX, innerY - 4, p.rawValues);
            }
          } else if (isSimple) {
            doc.text(`Genislik (En): ${p.rawValues?.width || 0} cm`, MARGIN + 8, innerY);
            doc.text(`Yukseklik (Boy): ${p.rawValues?.height || 0} cm`, MARGIN + 8, innerY + 6);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(37, 99, 235);
            doc.text(`Toplam: ${dims.structuralWidth} x ${dims.structuralHeight} cm`, MARGIN + 8, innerY + 14);

            drawSimpleDiagram(doc, rightColX, innerY - 4, Number(p.rawValues?.width || 0), Number(p.rawValues?.height || 0));
          } else {
             let customY = innerY;
             Object.entries(p.rawValues || {}).forEach(([k, v]) => {
                const template = MEASUREMENT_TEMPLATES[p.templateType];
                const label = template?.fields.find(f => f.key === k)?.label || k;
                doc.text(`${sanitize(label)}: ${v}`, MARGIN + 8, customY);
                customY += 6;
             });
          }

          if (validNote) {
            doc.setFontSize(8);
            doc.setTextColor(217, 119, 6);
            doc.setFont('helvetica', 'bold');
            doc.text(`Saha Notu: ${sanitize(validNote)}`, MARGIN + 8, y + boxHeight - 6);
          }

          y += boxHeight + 4;
        });
      });

      // Render Tables for Plicell
      if (plicellProducts.length > 0) {
        if (y > PAGE_HEIGHT - 30) { doc.addPage(); y = MARGIN; }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(`[Olcu Grubu: Plicell Cam Ici Olcusu]`, MARGIN + 4, y);
        y += 4;

        const tableData: string[][] = [];
        plicellProducts.forEach(item => {
           const camListesi = item.p.rawValues?.plicellCamListesi;
           if (camListesi && Array.isArray(camListesi) && camListesi.length > 0) {
             const validCamListesi = camListesi.filter((cam: any) => Number(cam.widthCm) > 0 && Number(cam.heightCm) > 0);
             const profilRengi = item.p.rawValues?.profilRengi;
             const profilTxt = profilRengi ? `[Renk: ${profilRengi}] ` : '';

             validCamListesi.forEach((cam: any, idx: number) => {
               tableData.push([
                 sanitize(item.winName),
                 `${idx + 1}. Cam`,
                 `${cam.widthCm || 0} cm`,
                 `${cam.heightCm || 0} cm`,
                 sanitize(profilTxt + (cam.note || '-'))
               ]);
             });
           } else {
             const dims = getMeasurementDimensions(item.p);
             tableData.push([
               sanitize(item.winName),
               `${item.index}. Olcu`,
               `${dims.structuralWidth} cm`,
               `${dims.structuralHeight} cm`,
               sanitize(getValidNote(item.p.notes) || '-')
             ]);
           }
        });

        y = drawSimpleTable(doc, MARGIN + 4, y, ['Aciklik', 'No', 'En', 'Boy', 'Notlar'], tableData) + 10;
      }

      // Render Tables for Mechanical
      if (mechanicalProducts.length > 0) {
        if (y > PAGE_HEIGHT - 30) { doc.addPage(); y = MARGIN; }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text(`[Olcu Grubu: Mekanik Perde]`, MARGIN + 4, y);
        y += 4;

         const tableData = mechanicalProducts.map((item, idx) => {
            const w = Number(item.p.rawValues?.width || 0);
            const h = Number(item.p.rawValues?.height || 0);
            const q = Number(item.p.rawValues?.quantity || 1);
            const pLabel = resolveMeasurementProductLabel(item.p);
            const calcWidth = item.p.details?.billingWidth || Math.ceil(w / 10) * 10 || w;
            const calcHeight = item.p.details?.billingHeight || h;
            const totalM2 = item.p.details?.totalM2 !== undefined ? Number(item.p.details.totalM2) : (calcWidth * calcHeight * q) / 10000;
            const unitM2 = totalM2 / q;

            const chainDirection =
              item.p.details?.chainDirection ||
              item.p.selectedProducts?.[0]
                ?.calculation
                ?.chainDirection ||
              'RIGHT';

            return [
              sanitize(item.winName),
              sanitize(pLabel),
              `${w.toFixed(0)} cm`,
              `${h.toFixed(0)} cm`,
              `${calcWidth} cm`,
              `${calcHeight} cm`,
              `${q}`,
              chainDirection === 'LEFT'
                ? 'Sol'
                : 'Sag',
              `${unitM2.toFixed(2)}`,
              `${totalM2.toFixed(2)}`,
              sanitize(getValidNote(item.p.notes) || '-')
            ];
          });

          y = drawSimpleTable(
            doc,
            MARGIN + 4,
            y,
            [
              'Aciklik',
              'Urun Tipi',
              'Gerc.En',
              'Gerc.Boy',
              'Hesap En',
              'Hes.Boy',
              'Adet',
              'Zincir',
              'Bir.m2',
              'Top.m2',
              'Notlar'
            ],
            tableData
          ) + 10;
      }

      y += 4;
    });
  }

  const fileName = `olcu-raporu-${sanitize(customer.name).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
  const blob = doc.output('blob');
  return new File([blob], fileName, { type: 'application/pdf' });
}
