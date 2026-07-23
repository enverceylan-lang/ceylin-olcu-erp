import React from 'react';
import {
  getProductVisualLegendItems
} from '@/lib/productVisualLegend';

export interface MechanicalVisualPanel {
  id?: string;
  productType: string;
  groupType?: 'CAM_PENCERE' | 'KAPI' | string;
  widthCm: number;
  heightCm: number;
  chainDirection?: 'LEFT' | 'RIGHT';

  startCm?: number;
  endCm?: number;

  firstSegmentIndex?: number;
  lastSegmentIndex?: number;
}

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
  productTypes?: string[];
  fonPlacement?: 'LEFT' | 'BOTH';
  productHeights?: Array<{
    productType: string;
    label: string;
    heightCm: number;
  }>;
  suppressFacadeHeight?: boolean;
  mechanicalPanels?: MechanicalVisualPanel[];
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
    productTypes = [],
    fonPlacement,
    productHeights = [],
    suppressFacadeHeight = false,
    mechanicalPanels = [],
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

  /*
   * Seçili ürünleri cephe üzerinde belirgin çizgilerle göster.
   * Teknik ölçü çizgileri değişmez; ürün çizgileri ayrı katmandır.
   */
  const MECHANICAL_TYPES = new Set([
  'STOR',
  'ZEBRA',
  'AHSAP_JALUZI',
  'JALUZI',
  'PICASSO'
]);
const productLegendItems =
    getProductVisualLegendItems(productTypes);

  const lineOnlyLegendItems =
    productLegendItems.filter(
      item =>
        ![
          'STOR',
          'ZEBRA',
          'AHSAP_JALUZI',
          'JALUZI',
          'PICASSO'
        ].includes(
          String(item.productType || '').toUpperCase()
        )
    );
  /*
   * Mekanik ürün uygulama krokileri teknik cephe çiziminin
   * ALTINDA, bağımsız bir bantta gösterilir.
   */
  if (
    mechanicalPanels.length > 0 &&
    facadeSegments.length > 0
  ) {
    const totalFacadeWidth =
      facadeSegments.reduce(
        (sum, segment) =>
          sum +
          Math.max(
            0,
            Number(segment.widthCm || 0)
          ),
        0
      ) || 1;

    let spanCursorX = startX;

    const openingSpans: Array<{
      x: number;
      width: number;
      type: 'CAM_PENCERE' | 'KAPI';
    }> = [];

    facadeSegments.forEach(segment => {
      const segmentWidthCm =
        Math.max(
          0,
          Number(segment.widthCm || 0)
        );

      const segmentDrawWidth =
        (segmentWidthCm / totalFacadeWidth) *
        drawW;

      const segmentType =
        String(
          segment.type || ''
        ).toUpperCase();

      if (
        segmentType === 'GLASS' ||
        segmentType === 'WINDOW'
      ) {
        const previous =
          openingSpans[
            openingSpans.length - 1
          ];

        /*
         * Yan yana CAM + PENCERE bölümleri tek mekanik
         * uygulama alanı olarak birleştirilebilir.
         */
        if (
          previous &&
          previous.type === 'CAM_PENCERE' &&
          Math.abs(
            previous.x +
              previous.width -
              spanCursorX
          ) < 0.5
        ) {
          previous.width +=
            segmentDrawWidth;
        } else {
          openingSpans.push({
            x: spanCursorX,
            width: segmentDrawWidth,
            type: 'CAM_PENCERE'
          });
        }
      } else if (
        segmentType === 'DOOR'
      ) {
        openingSpans.push({
          x: spanCursorX,
          width: segmentDrawWidth,
          type: 'KAPI'
        });
      }

      spanCursorX +=
        segmentDrawWidth;
    });

    const panelLayerTop =
      yCursor + 18;

    const maximumProductHeight =
      Math.max(
        1,
        ...mechanicalPanels.map(panel =>
          Number(panel.heightCm || 0)
        )
      );

    const panelLayerHeight =
      92;

    const typeCounters: Record<
      string,
      number
    > = {
      CAM_PENCERE: 0,
      KAPI: 0
    };

    elements.push(
      <text
        key="mechanical-layer-title"
        x={startX}
        y={panelLayerTop - 7}
        fill="#475569"
        fontSize="9"
        fontWeight="bold"
        stroke="none"
      >
        MEKANİK ÜRÜN UYGULAMA PLANI
      </text>
    );

    mechanicalPanels.forEach(
      (panel, panelIndex) => {
        const normalizedGroupType =
          String(
            panel.groupType || ''
          ).toUpperCase() === 'KAPI'
            ? 'KAPI'
            : 'CAM_PENCERE';

        const matchingSpans =
          openingSpans.filter(
            span =>
              span.type ===
              normalizedGroupType
          );

        const fallbackSpans =
          matchingSpans.length > 0
            ? matchingSpans
            : openingSpans;

        if (fallbackSpans.length === 0) {
          return;
        }

        /*
         * Aynı gruptaki mekanik parçalar üst üste binmez.
         * Her parça kendi sırasındaki açıklık alanına yerleşir.
         */
        const sameGroupPanels =
          mechanicalPanels.filter(
            candidate =>
              (
                String(
                  candidate.groupType || ''
                ).toUpperCase() === 'KAPI'
                  ? 'KAPI'
                  : 'CAM_PENCERE'
              ) === normalizedGroupType
          );

        const panelOrder =
          sameGroupPanels.findIndex(
            candidate =>
              candidate === panel ||
              (
                candidate.id &&
                panel.id &&
                candidate.id === panel.id
              )
          );

        const safePanelOrder =
          panelOrder >= 0
            ? panelOrder
            : 0;

        const targetSpan =
          fallbackSpans[
            Math.min(
              safePanelOrder,
              fallbackSpans.length - 1
            )
          ];

        const legend =
          productLegendItems.find(
            item =>
              String(
                item.productType || ''
              ).toUpperCase() ===
              String(
                panel.productType || ''
              ).toUpperCase()
          );

        const panelColor =
          legend?.color ||
          '#16a34a';

        const proportionalHeight =
          (
            Math.max(
              1,
              Number(panel.heightCm || 0)
            ) /
            maximumProductHeight
          ) *
          58;

        const panelHeight =
          Math.max(
            34,
            Math.min(
              58,
              proportionalHeight
            )
          );

        /*
         * Panel, uygulandığı cam/kapı alanının yatay hizasında.
         * Teknik cephe kutusunun içinde değil, altında çizilir.
         */
        /*
         * Hesap motoru konumu biliyorsa doğrudan onu kullan.
         * Böylece 55C + 65P + 55C tek 195 cm panel olarak çizilir.
         */
        const hasCalculatedPosition =
          Number(panel.endCm || 0) >
          Number(panel.startCm || 0);

        const calculatedPanelX =
          startX +
          (
            Number(panel.startCm || 0) /
            Math.max(
              1,
              totalFacadeWidth
            )
          ) *
          drawW;

        const calculatedPanelWidth =
          (
            (
              Number(panel.endCm || 0) -
              Number(panel.startCm || 0)
            ) /
            Math.max(
              1,
              totalFacadeWidth
            )
          ) *
          drawW;

        const groupedPanelTotalWidthCm =
          Math.max(
            1,
            sameGroupPanels.reduce(
              (sum, item) =>
                sum +
                Math.max(
                  0,
                  Number(item.widthCm || 0)
                ),
              0
            )
          );

        const groupedPanelPreviousWidthCm =
          sameGroupPanels
            .slice(0, safePanelOrder)
            .reduce(
              (sum, item) =>
                sum +
                Math.max(
                  0,
                  Number(item.widthCm || 0)
                ),
              0
            );

        const groupedSpanStartX =
          Math.min(
            ...fallbackSpans.map(span => span.x)
          );

        const groupedSpanEndX =
          Math.max(
            ...fallbackSpans.map(
              span => span.x + span.width
            )
          );

        const groupedSpanWidth =
          Math.max(
            22,
            groupedSpanEndX - groupedSpanStartX
          );

        const groupedPanelX =
          groupedSpanStartX +
          (
            groupedPanelPreviousWidthCm /
            groupedPanelTotalWidthCm
          ) *
          groupedSpanWidth;

        const groupedPanelWidth =
          (
            Math.max(
              1,
              Number(panel.widthCm || 0)
            ) /
            groupedPanelTotalWidthCm
          ) *
          groupedSpanWidth;

        const useGroupedPanelPlacement =
          sameGroupPanels.length > 1;

        const panelX =
          useGroupedPanelPlacement
            ? groupedPanelX + 3
            : hasCalculatedPosition
              ? calculatedPanelX
              : targetSpan.x + 3;

        const panelWidth =
          useGroupedPanelPlacement
            ? Math.max(
                22,
                groupedPanelWidth - 6
              )
            : hasCalculatedPosition
              ? Math.max(
                  22,
                  calculatedPanelWidth
                )
              : Math.max(
                  22,
                  targetSpan.width - 6
                );

        const panelY =
          panelLayerTop +
          (
            58 -
            panelHeight
          );

        const panelBottom =
          panelY +
          panelHeight;

        const chainLeft =
          String(
            panel.chainDirection ||
            'RIGHT'
          ).toUpperCase() ===
          'LEFT';

        /*
         * Zincir panelin DIŞ kenarında görünür.
         */
        const chainX =
          chainLeft
            ? panelX - 6
            : panelX +
              panelWidth +
              6;

        const label =
          legend?.label ||
          String(
            panel.productType || ''
          );

        const normalizedProductType =
          String(
            panel.productType || ''
          ).toUpperCase();

        const productTypeSequence =
          mechanicalPanels
            .slice(0, panelIndex + 1)
            .filter(item =>
              String(
                item.productType || ''
              ).toUpperCase() ===
              normalizedProductType
            ).length;

        const shortMechanicalName =
          normalizedProductType === 'STOR'
            ? 'Stor'
            : normalizedProductType === 'ZEBRA'
              ? 'Zebra'
              : normalizedProductType === 'JALUZI' || normalizedProductType === 'JALUZI'
                ? 'Jaluzi'
                : normalizedProductType === 'AHSAP_JALUZI' || normalizedProductType === 'AHŞAP_JALUZI' || normalizedProductType === 'AHSAP JALUZI' || normalizedProductType === 'AHŞAP JALUZI'
                  ? 'Ahşap J.'
                  : normalizedProductType === 'PICASSO'
                    ? 'Picasso'
                    : normalizedProductType === 'PLICELL'
                      ? 'Plicell'
                      : normalizedProductType === 'DIKEY_STOR' || normalizedProductType === 'DİKEY_STOR'
                        ? 'Dikey Stor'
                        : normalizedProductType === 'DIKEY_TUL' || normalizedProductType === 'DİKEY_TUL'
                          ? 'Dikey Tül'
                          : label;

        const panelShortLabel =
          `${shortMechanicalName} ${productTypeSequence}`;

        elements.push(
          <g
            key={`${String(
              panel.id || 'panel'
            )}-${String(
              panel.productType || 'product'
            )}-${String(
              panel.groupType || 'group'
            )}-${panelIndex}`}
          >
            <rect
              x={panelX}
              y={panelY}
              width={panelWidth}
              height={panelHeight}
              rx="2"
              fill="none"
              stroke={panelColor}
              strokeWidth="3"
            />

            {/* Üst kasa */}
            <line
              x1={panelX}
              y1={panelY + 6}
              x2={
                panelX +
                panelWidth
              }
              y2={panelY + 6}
              stroke={panelColor}
              strokeWidth="4"
              strokeLinecap="round"
            />

            {/* Zincir dış kenarda */}
            <line
              x1={chainX}
              y1={panelY + 7}
              x2={chainX}
              y2={panelBottom - 4}
              stroke={panelColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            <circle
              cx={chainX}
              cy={panelBottom}
              r="3.5"
              fill="#ffffff"
              stroke={panelColor}
              strokeWidth="2"
            />

            <text
              x={
                panelX +
                panelWidth / 2
              }
              y={panelY + 21}
              fill={panelColor}
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
              stroke="none"
            >
              {panelShortLabel}
            </text>


            <text
              x={chainX}
              y={panelBottom + 14}
              dx={
                chainLeft
                  ? -5
                  : 5
              }
              fill={panelColor}
              fontSize="8"
              fontWeight="bold"
              textAnchor={
                chainLeft
                  ? 'end'
                  : 'start'
              }
              stroke="none"
            >
              {chainLeft
                ? 'ZİNCİR SOL'
                : 'ZİNCİR SAĞ'}
            </text>
          </g>
        );
      }
    );

    yCursor =
      panelLayerTop +
      panelLayerHeight;
  }
if (productLegendItems.length > 0) {
    const layerStartY =
      segStartY + 8;

    const availableHeight =
      Math.max(20, totalSegH - 16);

    const layerGap =
      Math.min(
        12,
        availableHeight /
          Math.max(productLegendItems.length, 1)
      );

    lineOnlyLegendItems.forEach(
      (item, index) => {
        const tulleIndex =
          Math.max(
            0,
            lineOnlyLegendItems.findIndex(
              candidate =>
                String(
                  candidate.productType || ''
                ).toUpperCase() === 'TUL'
            )
          );

        const relativeIndex =
          index - tulleIndex;

        /*
         * Tül ana referans çizgisidir.
         * Güneşlik ve diğer yatay ürünler tülün hemen altında
         * küçük aralıklarla aynı başlangıç hizasında görünür.
         */
        const baseProductLineY =
          segStartY + 12;

        const alignedLineGap = 8;

        const lineY =
          item.productType === 'TAVAN_RUSTIK'
            ? segStartY + 3
            : baseProductLineY +
              Math.max(
                0,
                relativeIndex
              ) *
                alignedLineGap;

        /*
         * Fon iki kanat şeklinde, sağ ve sol tarafta gösterilir.
         */
        if (item.productType === 'FON') {
          elements.push(
            <g
              key={`product-layer-${item.productType}`}
              stroke={item.color}
              strokeWidth={item.lineWidth}
              fill="none"
              strokeLinecap="round"
            >
              <line
                x1={startX + 10}
                y1={lineY}
                x2={startX + 10}
                y2={segStartY + totalSegH - 8}
              />

              {fonPlacement !== 'LEFT' && (                 <line                   x1={endX - 10}                   y1={lineY}                   x2={endX - 10}                   y2={segStartY + totalSegH - 8}                 />               )}
            </g>
          );

          return;
        }

        /*
         * Tavan rustik cephenin üstünde mavi hat olarak gösterilir.
         */
        const effectiveY =
          item.productType === 'TAVAN_RUSTIK'
            ? segStartY + 3
            : lineY;

        elements.push(
          <g
            key={`product-layer-${item.productType}`}
            stroke={item.color}
            strokeWidth={item.lineWidth}
            fill="none"
            strokeLinecap="round"
          >
            <line
              x1={startX + 8}
              y1={effectiveY}
              x2={endX - 8}
              y2={effectiveY}
            />

            {item.doubleLine && (
              <line
                x1={startX + 8}
                y1={effectiveY + 4}
                x2={endX - 8}
                y2={effectiveY + 4}
              />
            )}
          </g>
        );
      }
    );

    yCursor += 16;

    const legendStartY =
      yCursor;

    const legendColumnWidth =
      190;

    const legendRowHeight =
      18;

    productLegendItems.forEach(
      (item, index) => {
        const column =
          index % 3;

        const row =
          Math.floor(index / 3);

        const legendX =
          startX +
          column * legendColumnWidth;

        const legendY =
          legendStartY +
          row * legendRowHeight;

        elements.push(
          <g
            key={`product-legend-${item.productType}`}
          >
            <line
              x1={legendX}
              y1={legendY}
              x2={legendX + 28}
              y2={legendY}
              stroke={item.color}
              strokeWidth={item.lineWidth}
              strokeLinecap="round"
            />

            {item.doubleLine && (
              <line
                x1={legendX}
                y1={legendY + 4}
                x2={legendX + 28}
                y2={legendY + 4}
                stroke={item.color}
                strokeWidth={item.lineWidth}
                strokeLinecap="round"
              />
            )}

            <text
              x={legendX + 36}
              y={legendY + 4}
              fill="#111"
              fontSize="11"
              fontWeight="bold"
              stroke="none"
            >
              {item.label}
            </text>
          </g>
        );
      }
    );

    yCursor +=
      Math.ceil(
        productLegendItems.length / 3
      ) *
        legendRowHeight +
      8;
  }

  const sideHeightTypographyV2 = true;
  const normalizedSidePanelProductTypes =
    productTypes.map(productType =>
      String(productType || '').toUpperCase()
    );

  const shouldShowMermerBoyu =
    normalizedSidePanelProductTypes.includes(
      'GUNESLIK'
    );

  const sideHeightNotes = [
    ...productHeights.map(item => ({       label: item.label,       value: Number(item.heightCm || 0)     })),
    {
      label: 'Kartonpiyer Boşluğu',
      value: Number(kartonpiyerBoslukCm || 0)
    },
    {
      label: 'Cam Üstü',
      value: Number(camUstuCm || 0)
    },
    {
      label: 'Cam İçi',
      value: Number(camIciCm || 0)
    },
    {
      label: 'Mermer Boyu',
      value: shouldShowMermerBoyu ? Number(kaloriferMermerBoyuCm || 0) : 0
    },
    {
      label: 'Cam Altı',
      value: Number(camAltiCm || 0)
    },
  ].filter(item => item.value > 0);

  if (sideHeightNotes.length > 0) {
    const sidePanelX =
      endX + 6;

    const sidePanelY =
      segStartY + 8;

    elements.push(
      <g key="side-height-notes">
        <text
          x={sidePanelX}
          y={sidePanelY}
          fill="#0f172a"
          fontSize="12.5"
          fontWeight="800"
          stroke="none"
        >
          BOY ÖLÇÜLERİ
        </text>

        {sideHeightNotes.map(
          (item, index) => {
            const itemY =
              sidePanelY +
              22 +
              index * 22;

            return (
              <g
                key={'side-height-' + index + '-' + item.label}
              >
                <text
                  x={sidePanelX}
                  y={itemY}
                  fill="#111827"
                  fontSize="11.5"
                  fontWeight="700"
                  stroke="none"
                >
                  {item.label}
                </text>

                <text
                  x={sidePanelX + 147}
                  y={itemY}
                  fill="#0f172a"
                  fontSize="11.5"
                  fontWeight="800"
                  textAnchor="end"
                  stroke="none"
                >
                  {item.value} cm
                </text>
              </g>
            );
          }
        )}
      </g>
    );
  }
  // CEYLIN_SLOPED_CEILING_HEIGHT_RULE_V1
  const enteredFacadeHeights = [
    {
      key: 'SOL',
      label: 'SOL BOY',
      value: Number(solYukseklikCm || 0)
    },
    {
      key: 'ORTA',
      label: 'ORTA BOY',
      value: Number(ortaYukseklikCm || 0)
    },
    {
      key: 'SAĞ',
      label: 'SAĞ BOY',
      value: Number(sagYukseklikCm || 0)
    }
  ].filter(item => item.value > 0);

  if (enteredFacadeHeights.length > 0 && !suppressFacadeHeight) {
    yCursor += 25;

    elements.push(
      <g
        key="bottom-facade-heights"
        stroke="#111"
        strokeWidth="1"
        fill="none"
      >
        <line
          x1={startX}
          y1={yCursor - 15}
          x2={startX}
          y2={yCursor - 5}
        />
        <line
          x1={endX}
          y1={yCursor - 15}
          x2={endX}
          y2={yCursor - 5}
        />
        <line
          x1={startX}
          y1={yCursor - 10}
          x2={endX}
          y2={yCursor - 10}
        />
      </g>
    );

    if (enteredFacadeHeights.length === 1) {
      elements.push(
        <text
          key="single-facade-height"
          x={startX + drawW / 2}
          y={yCursor + 10}
          fill="#111"
          fontSize="12"
          fontWeight="bold"
          textAnchor="middle"
          stroke="none"
        >
          {enteredFacadeHeights[0].value} BOY
        </text>
      );
    } else {
      const positions =
        enteredFacadeHeights.length === 2
          ? [
              {
                x: startX,
                anchor: 'start' as const
              },
              {
                x: endX,
                anchor: 'end' as const
              }
            ]
          : [
              {
                x: startX,
                anchor: 'start' as const
              },
              {
                x: startX + drawW / 2,
                anchor: 'middle' as const
              },
              {
                x: endX,
                anchor: 'end' as const
              }
            ];

      enteredFacadeHeights.forEach(
        (item, index) => {
          const position = positions[index];

          elements.push(
            <text
              key={'facade-height-' + item.key}
              x={position.x}
              y={yCursor + 10}
              fill="#111"
              fontSize="12"
              fontWeight="bold"
              textAnchor={position.anchor}
              stroke="none"
            >
              {item.value} {item.label}
            </text>
          );
        }
      );
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
