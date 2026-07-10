import jsPDF from 'jspdf';
import { Customer, ProductMeasurement, MEASUREMENT_TEMPLATES } from '@/store/useStore';
import { getTemplateLabel, getMeasurementDimensions } from '@/lib/measurementAdapter';
import { formatFacadeForReport } from '@/lib/facadeHelper';

// A4 Dimensions in mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;

function drawSimpleTable(doc: jsPDF, startX: number, startY: number, head: string[], body: string[][]): number {
  let y = startY;
  const colWidths = head.map((h, i) => i === 0 ? 30 : i === head.length - 1 ? 50 : 20); // rough widths
  
  // Draw header
  doc.setFillColor(241, 245, 249);
  doc.rect(startX, y, PAGE_WIDTH - startX - MARGIN, 8, 'FD');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  
  let currentX = startX + 2;
  head.forEach((h, i) => {
    doc.text(h, currentX, y + 5);
    currentX += colWidths[i];
  });
  
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  // Draw body
  body.forEach(row => {
    // Check page break for row
    if (y > PAGE_HEIGHT - 20) {
      doc.addPage();
      y = MARGIN;
    }
    
    let maxRowHeight = 8;
    // Calculate row height based on notes wrapping
    const notesStr = row[row.length - 1];
    const notesLines = doc.splitTextToSize(notesStr, colWidths[colWidths.length - 1] - 4);
    if (notesLines.length > 1) {
      maxRowHeight = notesLines.length * 4 + 4;
    }
    
    doc.setDrawColor(226, 232, 240);
    doc.rect(startX, y, PAGE_WIDTH - startX - MARGIN, maxRowHeight);
    
    currentX = startX + 2;
    row.forEach((cell, i) => {
      if (i === row.length - 1) {
        doc.text(notesLines, currentX, y + 5);
      } else {
        doc.text(cell, currentX, y + 5);
      }
      currentX += colWidths[i];
    });
    
    y += maxRowHeight;
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

function drawFacadeSegmentsDiagram(doc: jsPDF, x: number, y: number, rawValues: any) {
  const segments = rawValues.facadeSegments || [];
  if (segments.length === 0) return 60;

  const totalWidth = segments.reduce((sum: number, s: any) => sum + (Number(s.widthCm) > 0 ? Number(s.widthCm) : 0), 0);
  const karton = Number(rawValues.kartonpiyerBoslukCm || 0);
  const camUstu = Number(rawValues.camUstuCm || 0);
  const camIci = Number(rawValues.camIciCm || 0);
  const kaloriferMermer = Number(rawValues.kaloriferMermerBoyuCm || 0);
  const camAlti = Number(rawValues.camAltiCm || 0);

  const sol = Number(rawValues.solYukseklikCm || 0);
  const orta = Number(rawValues.ortaYukseklikCm || 0);
  const sag = Number(rawValues.sagYukseklikCm || 0);

  const drawW = 100; // max width for the diagram
  let currentY = y + 5;
  
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(`${totalWidth} EN`, x + drawW/2, currentY, { align: 'center' });
  currentY += 2;

  const segH = 15;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.rect(x, currentY, drawW, segH);

  let currentX = x;
  
  segments.forEach((seg: any, i: number) => {
    const pct = totalWidth > 0 ? Number(seg.widthCm) / totalWidth : 1/segments.length;
    const w = Math.max(pct * drawW, 8); // min 8mm
    
    if (i > 0) {
      doc.setLineDashPattern([1, 1], 0);
      doc.line(currentX, currentY, currentX, currentY + segH);
      doc.setLineDashPattern([], 0);
    }
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(`${seg.widthCm}`, currentX + w/2, currentY + 6, { align: 'center' });
    
    const lbl = seg.label.length > 5 ? seg.label.substring(0,3).toUpperCase() + '.' : seg.label.toUpperCase();
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.text(lbl, currentX + w/2, currentY + 11, { align: 'center' });
    
    currentX += w;
  });
  
  currentY += segH + 5;

  const rightDetails = [];
  if (karton > 0) rightDetails.push(`KARTONPIYER B.: ${karton}`);
  if (camUstu > 0) rightDetails.push(`CAM USTU: ${camUstu}`);
  if (camIci > 0) rightDetails.push(`CAM ICI: ${camIci}`);
  if (kaloriferMermer > 0) rightDetails.push(`KALORIFER/MERMER: ${kaloriferMermer}`);
  if (camAlti > 0) rightDetails.push(`CAM ALTI: ${camAlti}`);

  if (sol > 0 || orta > 0 || sag > 0) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    let hTxt = [];
    if (sol > 0) hTxt.push(`${sol} SOL YUKS.`);
    if (orta > 0) hTxt.push(`${orta} ORTA YUKS.`);
    if (sag > 0) hTxt.push(`${sag} SAG YUKS.`);
    doc.text(hTxt.join('   '), x + drawW/2, currentY, { align: 'center' });
    currentY += 5;
  }

  if (rightDetails.length > 0) {
     let startY = y + 5;
     doc.setFontSize(6);
     doc.setLineDashPattern([1, 1], 0);
     doc.line(x + drawW + 5, y + 5, x + drawW + 5, y + 25);
     doc.setLineDashPattern([], 0);
     
     rightDetails.forEach((d) => {
       doc.text(d, x + drawW + 8, startY);
       startY += 4;
     });
     currentY = Math.max(currentY, startY);
  }

  return Math.max(40, currentY - y);
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

export async function generateMeasurementPdfBlob(customer: Customer, sameMeasuredBy: string | null): Promise<File> {
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
  doc.text('CEYLIN OLCU ERP', PAGE_WIDTH / 2, y, { align: 'center' });
  
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
  
  const sanitize = (str: string) => str.replace(/İ/g, 'I').replace(/ı/g, 'i').replace(/Ş/g, 'S').replace(/ş/g, 's').replace(/Ğ/g, 'G').replace(/ğ/g, 'g').replace(/Ü/g, 'U').replace(/ü/g, 'u').replace(/Ö/g, 'O').replace(/ö/g, 'o').replace(/Ç/g, 'C').replace(/ç/g, 'c');
  
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
        const plicell = win.products?.filter(p => p.templateType === 'PLICELL') || [];
        const mech = win.products?.filter(p => p.templateType === 'mechanical_curtain') || [];
        const std = win.products?.filter(p => p.templateType !== 'PLICELL' && p.templateType !== 'mechanical_curtain') || [];
        
        plicell.forEach((p, i) => plicellProducts.push({ p, index: i, winName: win.name }));
        mech.forEach((p, i) => mechanicalProducts.push({ p, index: i, winName: win.name }));
        if (std.length > 0) standardOpenings.push({ winName: win.name, winItem: win, products: std });
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
          const boxHeight = p.notes ? 65 : 55; // Approximate box height
          doc.rect(MARGIN + 4, y, PAGE_WIDTH - MARGIN*2 - 4, boxHeight, 'FD');
          
          let innerY = y + 6;
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'bold');
          doc.text(`Olcu ${pIdx + 1}: ${sanitize(getTemplateLabel(p.templateType))}`, MARGIN + 8, innerY);
          
          const dims = getMeasurementDimensions(p);
          const isCurtain = p.templateType === 'CURTAIN_DETAIL' || p.templateType === 'CURTAIN';
          const isSimple = p.templateType === 'SIMPLE_WIDTH_HEIGHT';
          
          innerY += 8;
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          
          const rightColX = MARGIN + 80;
          
          if (isCurtain) {
            const facadeSegments = p.rawValues?.facadeSegments;
            if (facadeSegments && Array.isArray(facadeSegments) && facadeSegments.length > 0) {
              const facadeStr = formatFacadeForReport(facadeSegments).replace(/ç/g, 'c').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/Ç/g, 'C').replace(/Ş/g, 'S').replace(/Ğ/g, 'G').replace(/İ/g, 'I').replace(/Ö/g, 'O').replace(/Ü/g, 'U');
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
          
          if (p.notes) {
            doc.setFontSize(8);
            doc.setTextColor(217, 119, 6);
            doc.setFont('helvetica', 'bold');
            doc.text(`Saha Notu: ${sanitize(p.notes)}`, MARGIN + 8, y + boxHeight - 6);
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
        
        const tableData = plicellProducts.map(item => {
           const dims = getMeasurementDimensions(item.p);
           return [
             sanitize(item.winName),
             `${item.index}. Olcu`,
             `${dims.structuralWidth} cm`,
             `${dims.structuralHeight} cm`,
             sanitize(item.p.notes || '-')
           ];
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
        
        const tableData = mechanicalProducts.map(item => {
           const dims = getMeasurementDimensions(item.p);
           return [
             sanitize(item.winName),
             `${item.index}. Olcu`,
             `${item.p.rawValues?.width || 0} cm`,
             `${item.p.rawValues?.height || 0} cm`,
             `${dims.structuralWidth} x ${dims.structuralHeight}`,
             sanitize(item.p.notes || '-')
           ];
        });
        
        y = drawSimpleTable(doc, MARGIN + 4, y, ['Aciklik', 'No', 'Kumas En', 'Boy', 'Kasa/Mekanizma', 'Notlar'], tableData) + 10;
      }
      
      y += 4;
    });
  }
  
  const fileName = `olcu-raporu-${sanitize(customer.name).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`;
  const blob = doc.output('blob');
  return new File([blob], fileName, { type: 'application/pdf' });
}
