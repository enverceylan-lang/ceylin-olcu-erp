import React from 'react';

/**
 * Renders an SVG diagram for SIMPLE_WIDTH_HEIGHT template.
 */
export function renderSimpleWidthHeightDiagram(width: number, height: number): React.ReactNode {
  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[200px] h-auto border border-gray-200 dark:border-gray-800 rounded bg-gray-50/50 dark:bg-gray-900/50 p-2 mx-auto">
      {/* Bounding box */}
      <rect x="25" y="25" width="150" height="150" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
      
      {/* The window */}
      <rect x="35" y="35" width="130" height="130" fill="none" stroke="#2563eb" strokeWidth="2.5" rx="4" />
      {/* Pane divider */}
      <line x1="100" y1="35" x2="100" y2="165" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="2,2" />

      {/* Width Dimension */}
      <g stroke="#ef4444" strokeWidth="1.5">
        <line x1="35" y1="15" x2="165" y2="15" />
        <polygon points="35,15 42,11 42,19" fill="#ef4444" />
        <polygon points="165,15 158,11 158,19" fill="#ef4444" />
      </g>
      <text x="100" y="10" fill="#ef4444" fontSize="11" fontWeight="bold" textAnchor="middle">{width} cm</text>

      {/* Height Dimension */}
      <g stroke="#10b981" strokeWidth="1.5">
        <line x1="185" y1="35" x2="185" y2="165" />
        <polygon points="185,35 181,42 189,42" fill="#10b981" />
        <polygon points="185,165 181,158 189,158" fill="#10b981" />
      </g>
      <text x="192" y="104" fill="#10b981" fontSize="11" fontWeight="bold" textAnchor="start" dominantBaseline="middle">{height} cm</text>
    </svg>
  );
}

/**
 * Renders an SVG diagram for CURTAIN_DETAIL template.
 */
export function renderCurtainDetailDiagram(rawValues: any): React.ReactNode {
  const leftWall = Number(rawValues.leftWall || 0);
  const windowWidth = Number(rawValues.windowWidth || 0);
  const rightWall = Number(rawValues.rightWall || 0);
  const ceilingGap = Number(rawValues.ceilingGap || 0);
  const windowHeight = Number(rawValues.windowHeight || 0);
  const floorGap = Number(rawValues.floorGap || 0);

  const totalWidth = leftWall + windowWidth + rightWall;
  const totalHeight = ceilingGap + windowHeight + floorGap;

  const wallW = 220;
  const wallH = 135;
  const startX = 30;
  const startY = 25;
  
  let wPct = totalWidth > 0 ? windowWidth / totalWidth : 0.6;
  let lPct = totalWidth > 0 ? leftWall / totalWidth : 0.2;
  let rPct = totalWidth > 0 ? rightWall / totalWidth : 0.2;
  
  let hPct = totalHeight > 0 ? windowHeight / totalHeight : 0.6;
  let tPct = totalHeight > 0 ? ceilingGap / totalHeight : 0.2;
  let bPct = totalHeight > 0 ? floorGap / totalHeight : 0.2;
  
  // Clamp percentages to avoid clipping and keep text readable
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

  const winX = startX + lPct * wallW;
  const winY = startY + tPct * wallH;
  const winW = wPct * wallW;
  const winH = hPct * wallH;

  return (
    <svg viewBox="0 0 280 220" className="w-full max-w-[280px] h-auto border border-gray-200 dark:border-gray-800 rounded bg-gray-50/50 dark:bg-gray-900/50 p-2 mx-auto">
      {/* Wall Outline */}
      <rect x={startX} y={startY} width={wallW} height={wallH} fill="none" stroke="#64748b" strokeWidth="1.5" />
      
      {/* The Window */}
      <rect x={winX} y={winY} width={winW} height={winH} fill="none" stroke="#2563eb" strokeWidth="2.2" rx="2" />
      <line x1={winX + winW/2} y1={winY} x2={winX + winW/2} y2={winY + winH} stroke="#3b82f6" strokeWidth="1" strokeDasharray="2,2" />

      {/* Left Wall Width Line & Label */}
      {leftWall > 0 && (
        <g stroke="#ef4444" strokeWidth="1">
          <line x1={startX} y1={winY + winH/2} x2={winX} y2={winY + winH/2} />
          <text x={startX + (winX - startX)/2} y={winY + winH/2 - 4} fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle" stroke="none">{leftWall}</text>
        </g>
      )}

      {/* Window Width (En) Line & Label */}
      <g stroke="#ef4444" strokeWidth="1">
        <line x1={winX} y1={winY - 8} x2={winX + winW} y2={winY - 8} />
        <text x={winX + winW/2} y={winY - 12} fill="#ef4444" fontSize="8.5" fontWeight="bold" textAnchor="middle" stroke="none">{windowWidth}</text>
      </g>

      {/* Right Wall Width Line & Label */}
      {rightWall > 0 && (
        <g stroke="#ef4444" strokeWidth="1">
          <line x1={winX + winW} y1={winY + winH/2} x2={startX + wallW} y2={winY + winH/2} />
          <text x={winX + winW + (startX + wallW - (winX + winW))/2} y={winY + winH/2 - 4} fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle" stroke="none">{rightWall}</text>
        </g>
      )}

      {/* Ceiling Gap Height Line & Label */}
      {ceilingGap > 0 && (
        <g stroke="#10b981" strokeWidth="1">
          <line x1={winX + winW/2} y1={startY} x2={winX + winW/2} y2={winY} />
          <text x={winX + winW/2 + 4} y={startY + (winY - startY)/2} fill="#10b981" fontSize="8" fontWeight="bold" textAnchor="start" dominantBaseline="middle" stroke="none">{ceilingGap}</text>
        </g>
      )}

      {/* Window Height (Boy) Line & Label */}
      <g stroke="#10b981" strokeWidth="1">
        <line x1={winX + winW + 8} y1={winY} x2={winX + winW + 8} y2={winY + winH} />
        <text x={winX + winW + 12} y={winY + winH/2} fill="#10b981" fontSize="8.5" fontWeight="bold" textAnchor="start" dominantBaseline="middle" stroke="none">{windowHeight}</text>
      </g>

      {/* Floor Gap Height Line & Label */}
      {floorGap > 0 && (
        <g stroke="#10b981" strokeWidth="1">
          <line x1={winX + winW/2} y1={winY + winH} x2={winX + winW/2} y2={startY + wallH} />
          <text x={winX + winW/2 + 4} y={winY + winH + (startY + wallH - (winY + winH))/2} fill="#10b981" fontSize="8" fontWeight="bold" textAnchor="start" dominantBaseline="middle" stroke="none">{floorGap}</text>
        </g>
      )}

      {/* Total Width (at the bottom) */}
      <g stroke="#ef4444" strokeWidth="1.5">
        <line x1={startX} y1={startY + wallH + 15} x2={startX + wallW} y2={startY + wallH + 15} />
        <polygon points={`${startX},${startY + wallH + 15} ${startX + 4},${startY + wallH + 12} ${startX + 4},${startY + wallH + 18}`} fill="#ef4444" />
        <polygon points={`${startX + wallW},${startY + wallH + 15} ${startX + wallW - 4},${startY + wallH + 12} ${startX + wallW - 4},${startY + wallH + 18}`} fill="#ef4444" />
        <text x={startX + wallW/2} y={startY + wallH + 28} fill="#ef4444" fontSize="10" fontWeight="bold" textAnchor="middle" stroke="none">Toplam En: {totalWidth} cm</text>
      </g>

      {/* Total Height (on the left) */}
      <g stroke="#10b981" strokeWidth="1.5">
        <line x1={startX - 15} y1={startY} x2={startX - 15} y2={startY + wallH} />
        <polygon points={`${startX - 15},${startY} ${startX - 18},${startY + 4} ${startX - 12},${startY + 4}`} fill="#10b981" />
        <polygon points={`${startX - 15},${startY + wallH} ${startX - 18},${startY + wallH - 4} ${startX - 12},${startY + wallH - 4}`} fill="#10b981" />
        <text x={startX - 23} y={startY + wallH/2} fill="#10b981" fontSize="10" fontWeight="bold" textAnchor="middle" transform={`rotate(-90, ${startX - 23}, ${startY + wallH/2})`} stroke="none">Toplam Boy: {totalHeight} cm</text>
      </g>
    </svg>
  );
}
