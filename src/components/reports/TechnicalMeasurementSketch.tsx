import React from 'react';

export interface TechnicalMeasurementSketchProps {
  facadeSegments?: { widthCm: number; type: string; label: string; id?: string }[];
  totalFacadeWidthCm?: number;
  width?: number;
  height?: number;
  kartonpiyerBoslukCm?: number;
  camUstuCm?: number;
  camIciCm?: number;
  kaloriferMermerBoyuCm?: number;
  camAltiCm?: number;
  solYukseklikCm?: number;
  ortaYukseklikCm?: number;
  sagYukseklikCm?: number;
}

export function TechnicalMeasurementSketch(props: TechnicalMeasurementSketchProps) {
  const {
    facadeSegments = [],
    width = 0,
    height = 0,
    kartonpiyerBoslukCm = 0,
    camUstuCm = 0,
    camIciCm = 0,
    kaloriferMermerBoyuCm = 0,
    camAltiCm = 0,
    solYukseklikCm = 0,
    ortaYukseklikCm = 0,
    sagYukseklikCm = 0,
  } = props;

  let totalWidth = props.totalFacadeWidthCm || 0;
  
  if (facadeSegments.length === 0 && width > 0) {
    totalWidth = width;
  } else if (totalWidth === 0 && facadeSegments.length > 0) {
    totalWidth = facadeSegments.reduce((sum, s) => sum + (Number(s.widthCm) > 0 ? Number(s.widthCm) : 0), 0);
  }

  const svgW = 800;
  
  const startX = 40;
  const drawW = 600;
  const endX = startX + drawW;

  let yCursor = 40;
  const elements = [];

  // 1. Toplam En
  if (totalWidth > 0) {
    elements.push(
      <g key="totalWidth" stroke="#111" strokeWidth="1" fill="none">
        <line x1={startX} y1={yCursor - 10} x2={startX} y2={yCursor + 10} />
        <line x1={endX} y1={yCursor - 10} x2={endX} y2={yCursor + 10} />
        <line x1={startX} y1={yCursor} x2={endX} y2={yCursor} />
        <rect x={startX + drawW/2 - 40} y={yCursor - 10} width="80" height="20" fill="#fff" stroke="none" />
        <text x={startX + drawW/2} y={yCursor + 4} fill="#111" fontSize="14" fontWeight="bold" textAnchor="middle" stroke="none">
          {totalWidth} EN
        </text>
      </g>
    );
    yCursor += 30;
  }

  // 2. Kartonpiyer
  if (kartonpiyerBoslukCm > 0) {
    const kartonH = 30;
    elements.push(
      <g key="kartonpiyer" stroke="#111" strokeWidth="1" fill="none">
        <rect x={startX} y={yCursor} width={drawW} height={kartonH} />
        <text x={startX + drawW/2} y={yCursor + kartonH/2 + 4} fill="#111" fontSize="12" textAnchor="middle" stroke="none">
          {kartonpiyerBoslukCm} KARTONPİYER BOŞLUĞU
        </text>
      </g>
    );
    yCursor += kartonH;
  }

  // 3. Main Segments
  const camUstuH = camUstuCm > 0 ? 30 : 0;
  const camIciH = 90; 
  const kaloriferMermerH = kaloriferMermerBoyuCm > 0 ? 30 : 0;
  const camAltiH = camAltiCm > 0 ? 30 : 0;
  const totalSegH = camUstuH + camIciH + kaloriferMermerH + camAltiH;

  const segStartY = yCursor;
  
  if (facadeSegments.length > 0) {
    // Outer Frame
    elements.push(
      <rect key="segFrame" x={startX} y={segStartY} width={drawW} height={totalSegH} fill="none" stroke="#111" strokeWidth="1" />
    );

    let currentX = startX;
    
    // Calculate total valid width for percentages
    const validTotalWidth = facadeSegments.reduce((s, seg) => s + (Number(seg.widthCm) > 0 ? Number(seg.widthCm) : 0), 0);

    const segElements = facadeSegments.map((seg, i) => {
      const segW = Number(seg.widthCm) > 0 ? Number(seg.widthCm) : 0;
      const pct = validTotalWidth > 0 ? segW / validTotalWidth : 1 / facadeSegments.length;
      const w = pct * drawW; // strict proportional width
      const isOpening = seg.type !== 'WALL';
      
      let displayLabel = seg.label.toUpperCase();
      let labelFontSize = 11;
      let valFontSize = 13;

      if (w < 28) {
        displayLabel = ''; // very narrow, just number
        valFontSize = 10;
      } else if (w < 50) {
        displayLabel = seg.label.charAt(0).toUpperCase(); // narrow, D, C, P, K
        labelFontSize = 10;
        valFontSize = 11;
      } else {
        displayLabel = seg.label.length > 8 ? seg.label.substring(0, 8).toUpperCase() + '.' : seg.label.toUpperCase();
      }
      
      const g = (
        <g key={`seg-${i}`}>
          {/* Vertical Separator */}
          {i > 0 && <line x1={currentX} y1={segStartY} x2={currentX} y2={segStartY + totalSegH} stroke="#111" strokeWidth="1" />}
          
          {isOpening ? (
            <>
              {/* ÜST */}
              {camUstuCm > 0 && (
                <line x1={currentX} y1={segStartY + camUstuH} x2={currentX + w} y2={segStartY + camUstuH} stroke="#111" strokeWidth="1" />
              )}
              
              {/* İÇ (Main Body) */}
              <text x={currentX + w/2} y={segStartY + camUstuH + camIciH/2 - (displayLabel ? 6 : 0)} fill="#111" fontSize={valFontSize} fontWeight="bold" textAnchor="middle">{seg.widthCm}</text>
              {displayLabel && (
                <text x={currentX + w/2} y={segStartY + camUstuH + camIciH/2 + 10} fill="#111" fontSize={labelFontSize} textAnchor="middle">{displayLabel}</text>
              )}
              
              {/* KALORİFER / MERMER */}
              {kaloriferMermerBoyuCm > 0 && (
                <line x1={currentX} y1={segStartY + camUstuH + camIciH} x2={currentX + w} y2={segStartY + camUstuH + camIciH} stroke="#111" strokeWidth="1" />
              )}
              
              {/* ALT */}
              {camAltiCm > 0 && (
                <line x1={currentX} y1={segStartY + camUstuH + camIciH + kaloriferMermerH} x2={currentX + w} y2={segStartY + camUstuH + camIciH + kaloriferMermerH} stroke="#111" strokeWidth="1" />
              )}
            </>
          ) : (
            /* DUVAR */
            <>
              <text x={currentX + w/2} y={segStartY + totalSegH/2 - (displayLabel ? 6 : 0)} fill="#111" fontSize={valFontSize} fontWeight="bold" textAnchor="middle">{seg.widthCm}</text>
              {displayLabel && (
                <text x={currentX + w/2} y={segStartY + totalSegH/2 + 10} fill="#111" fontSize={labelFontSize} textAnchor="middle">{displayLabel}</text>
              )}
            </>
          )}
        </g>
      );
      currentX += w;
      return g;
    });

    elements.push(...segElements);
    
    // YAN TARAFTA TEK SEFERDE GÖSTERİLEN ÖLÇÜLER (Kaldırıldı - Mobilde taşmayı önlemek için)

    yCursor += totalSegH;
  } else if (width > 0) {
    // Simple Width Height Rectangle
    elements.push(
      <g key="simpleRect">
        <rect x={startX} y={segStartY} width={drawW} height={totalSegH} fill="none" stroke="#111" strokeWidth="1" />
        <text x={startX + drawW/2} y={segStartY + totalSegH/2 - 10} fill="#111" fontSize="14" fontWeight="bold" textAnchor="middle">EN: {width}</text>
        {height > 0 && (
          <text x={startX + drawW/2} y={segStartY + totalSegH/2 + 10} fill="#111" fontSize="14" fontWeight="bold" textAnchor="middle">BOY: {height}</text>
        )}
      </g>
    );
    yCursor += totalSegH;
  } else {
    // Empty drawing area
    yCursor += totalSegH;
  }

  // 4. Yükseklik Özeti (Bottom)
  if (solYukseklikCm > 0 || ortaYukseklikCm > 0 || sagYukseklikCm > 0) {
    yCursor += 25;
    
    // Draw bottom reference line
    elements.push(
      <g key="bottomHeights" stroke="#111" strokeWidth="1" fill="none">
        <line x1={startX} y1={yCursor - 15} x2={startX} y2={yCursor - 5} />
        <line x1={endX} y1={yCursor - 15} x2={endX} y2={yCursor - 5} />
        <line x1={startX} y1={yCursor - 10} x2={endX} y2={yCursor - 10} />
      </g>
    );

    if (solYukseklikCm > 0) {
      elements.push(<text key="solYuks" x={startX} y={yCursor + 10} fill="#111" fontSize="12" textAnchor="start" stroke="none">{solYukseklikCm} SOL BOY</text>);
    }
    if (ortaYukseklikCm > 0) {
      elements.push(<text key="ortaYuks" x={startX + drawW/2} y={yCursor + 10} fill="#111" fontSize="12" textAnchor="middle" stroke="none">{ortaYukseklikCm} ORTA BOY</text>);
    }
    if (sagYukseklikCm > 0) {
      elements.push(<text key="sagYuks" x={endX} y={yCursor + 10} fill="#111" fontSize="12" textAnchor="end" stroke="none">{sagYukseklikCm} SAĞ BOY</text>);
    }
    
    yCursor += 20;
  }

  const svgH = yCursor + 20;

  return (
    <div className="w-full overflow-x-auto print:overflow-visible my-4">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="auto" style={{ maxWidth: '800px', backgroundColor: '#fff', fontFamily: 'monospace, sans-serif' }}>
        {elements}
      </svg>
    </div>
  );
}
