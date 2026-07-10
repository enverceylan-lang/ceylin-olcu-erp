export const TEMPLATE_LABELS: Record<string, string> = {
  CURTAIN_DETAIL: "Detay Perde Ölçüsü",
  SIMPLE_WIDTH_HEIGHT: "Basit En-Boy Ölçüsü",
  PLICELL: "Plicell Cam İçi Ölçüsü",
  mechanical_curtain: "Mekanik Perde Ölçüsü",
  CURTAIN: "Detay Perde Ölçüsü" // legacy fallback mapping
};

export function getTemplateLabel(templateType: string): string {
  return TEMPLATE_LABELS[templateType] || templateType;
}

export interface MeasurementDimensions {
  rawWidth: number;
  rawHeight: number;
  structuralWidth: number;
  structuralHeight: number;
  templateType: string;
  summaryLabel: string;
}

export function getMeasurementDimensions(measurement: any): MeasurementDimensions {
  if (!measurement) {
    return {
      rawWidth: 0,
      rawHeight: 0,
      structuralWidth: 0,
      structuralHeight: 0,
      templateType: '',
      summaryLabel: ''
    };
  }

  const templateType = measurement.templateType || 'LEGACY';
  const rawValues = measurement.rawValues || {};

  let rawWidth = 0;
  let rawHeight = 0;
  let structuralWidth = 0;
  let structuralHeight = 0;
  let summaryLabel = '';

  if (templateType === 'CURTAIN_DETAIL' || templateType === 'CURTAIN') {
    // Check if facadeSegments exists
    const facadeSegments = rawValues.facadeSegments || [];
    
    // Old fields
    const leftWall = Number(rawValues.leftWall || 0);
    const windowWidth = Number(rawValues.windowWidth || 0);
    const rightWall = Number(rawValues.rightWall || 0);
    const ceilingGap = Number(rawValues.ceilingGap || 0);
    const windowHeight = Number(rawValues.windowHeight || 0);
    const floorGap = Number(rawValues.floorGap || 0);

    // New Height fields
    const kartonpiyer = Number(rawValues.kartonpiyerBoslukCm || 0);
    const camUstu = Number(rawValues.camUstuCm || 0);
    const solYukseklik = Number(rawValues.solYukseklikCm || 0);
    
    if (facadeSegments.length > 0) {
      // New Facade Logic
      const totalFacadeWidth = facadeSegments.reduce((sum: number, seg: any) => {
        const w = Number(seg.widthCm);
        return sum + (w > 0 ? w : 0);
      }, 0);
      
      // We take solYukseklik or windowHeight as the rawHeight if available
      const h = solYukseklik || windowHeight;
      const sh = solYukseklik || (ceilingGap + windowHeight + floorGap);
      
      rawWidth = totalFacadeWidth;
      rawHeight = h;
      structuralWidth = totalFacadeWidth;
      structuralHeight = Number(sh.toFixed(2));
      summaryLabel = `Cephe (Toplam En: ${totalFacadeWidth} cm)`;
    } else {
      // Old Logic
      rawWidth = windowWidth;
      rawHeight = windowHeight;
      structuralWidth = Number((leftWall + windowWidth + rightWall).toFixed(2));
      structuralHeight = Number((ceilingGap + windowHeight + floorGap).toFixed(2));
      summaryLabel = `Pencere: ${windowWidth}x${windowHeight} cm (Sol: ${leftWall}, Sağ: ${rightWall}, Tavan: ${ceilingGap}, Zemin: ${floorGap})`;
    }
  } else if (templateType === 'SIMPLE_WIDTH_HEIGHT') {
    const width = Number(rawValues.width || 0);
    const height = Number(rawValues.height || 0);

    rawWidth = width;
    rawHeight = height;
    structuralWidth = width;
    structuralHeight = height;
    summaryLabel = `Ölçü: ${width}x${height} cm`;
  } else if (templateType === 'PLICELL') {
    const glassWidth = Number(rawValues.glassWidth || 0);
    const glassHeight = Number(rawValues.glassHeight || 0);

    rawWidth = glassWidth;
    rawHeight = glassHeight;
    structuralWidth = glassWidth;
    structuralHeight = glassHeight;
    summaryLabel = `Cam: ${glassWidth}x${glassHeight} cm`;
  } else if (templateType === 'mechanical_curtain') {
    const productType = rawValues.productType || 'Mekanik Perde';
    const width = Number(rawValues.width || 0);
    const height = Number(rawValues.height || 0);
    const quantity = Number(rawValues.quantity || 1);

    rawWidth = width;
    rawHeight = height;
    structuralWidth = width;
    structuralHeight = height;
    summaryLabel = `${productType} — ${width} en x ${height} boy${quantity > 1 ? ` x ${quantity} Adet` : ''}`;
  } else {
    // Legacy measurements fallback
    structuralWidth = Number(measurement.calculatedWidth || measurement.width || 0);
    structuralHeight = Number(measurement.calculatedHeight || measurement.height || 0);
    rawWidth = Number(measurement.width || measurement.calculatedWidth || 0);
    rawHeight = Number(measurement.height || measurement.calculatedHeight || 0);
    summaryLabel = `Ölçü: ${rawWidth}x${rawHeight} cm`;
  }

  return {
    rawWidth,
    rawHeight,
    structuralWidth,
    structuralHeight,
    templateType,
    summaryLabel
  };
}

export interface FabricCalculationResult {
  calculationType: 'PLEATED' | 'FLAT_WIDTH_ALLOWANCE' | 'AREA' | 'UNIT' | 'FIXED_MULTIPLIER';
  pleatRequired: boolean;
  widthAllowanceCm: number;
  netWidth: number;
  netHeight: number;
  cuttingWidth: number;
  fabricUsageMeters: number;
  sewingTypeLabel: string;
  pleatLabel: string;
}

export function calculateFabricUsage(
  category: string,
  width: number,
  height: number,
  pleatType?: string,
  wingQuantity?: number
): FabricCalculationResult {
  const cat = (category || "").toLowerCase();
  
  if (cat === 'güneşlik') {
    const allowance = 30;
    const cuttingWidth = width + allowance;
    const fabricUsage = Number((cuttingWidth / 100).toFixed(2));
    return {
      calculationType: 'FLAT_WIDTH_ALLOWANCE',
      pleatRequired: false,
      widthAllowanceCm: allowance,
      netWidth: width,
      netHeight: height,
      cuttingWidth,
      fabricUsageMeters: fabricUsage,
      sewingTypeLabel: 'Düz Dikim',
      pleatLabel: 'Uygulanmaz'
    };
  }
  
  if (cat === 'tül') {
    const pleatMultipliers: Record<string, number> = { 'SPARSE': 2.1, 'NORMAL': 2.6, 'TIGHT': 3.1 };
    const multiplier = pleatMultipliers[pleatType || 'NORMAL'] || 2.6;
    const cuttingWidth = Number((width * multiplier).toFixed(2));
    const fabricUsage = Number((cuttingWidth / 100).toFixed(2));
    
    const pleatLabels: Record<string, string> = { 'SPARSE': 'Seyrek Pile (1/2.1)', 'NORMAL': 'Normal Pile (1/2.6)', 'TIGHT': 'Sık Pile (1/3.1)' };
    return {
      calculationType: 'PLEATED',
      pleatRequired: true,
      widthAllowanceCm: 0,
      netWidth: width,
      netHeight: height,
      cuttingWidth,
      fabricUsageMeters: fabricUsage,
      sewingTypeLabel: 'Pileli Dikim',
      pleatLabel: pleatLabels[pleatType || 'NORMAL'] || 'Normal Pile'
    };
  }

  if (cat === 'fon') {
    const multiplier = 2.5;
    const wings = wingQuantity || 1;
    const cuttingWidth = Number((width * multiplier * wings).toFixed(2));
    const fabricUsage = Number((cuttingWidth / 100).toFixed(2));
    return {
      calculationType: 'FIXED_MULTIPLIER',
      pleatRequired: false,
      widthAllowanceCm: 0,
      netWidth: width,
      netHeight: height,
      cuttingWidth,
      fabricUsageMeters: fabricUsage,
      sewingTypeLabel: `Fon Perde Dikimi (${wings} Kanat)`,
      pleatLabel: 'Uygulanmaz'
    };
  }

  if (cat === 'zebra' || cat === 'stor' || cat === 'jaluzi' || cat === 'plicell') {
    const area = (width / 100) * (height / 100);
    const fabricUsage = Number(Math.max(area, 2.0).toFixed(2));
    return {
      calculationType: 'AREA',
      pleatRequired: false,
      widthAllowanceCm: 0,
      netWidth: width,
      netHeight: height,
      cuttingWidth: width,
      fabricUsageMeters: fabricUsage,
      sewingTypeLabel: 'Mekanik Üretim',
      pleatLabel: 'Uygulanmaz'
    };
  }

  return {
    calculationType: 'UNIT',
    pleatRequired: false,
    widthAllowanceCm: 0,
    netWidth: width,
    netHeight: height,
    cuttingWidth: width,
    fabricUsageMeters: 1,
    sewingTypeLabel: 'Dikiş Gerekmiyor',
    pleatLabel: 'Uygulanmaz'
  };
}

export function getGoogleMapsUrl(customer: { mapLocation?: string; address?: string }): string | null {
  const location = (customer.mapLocation || "").trim();
  const address = (customer.address || "").trim();

  // Matches coordinates like: 41.0082, 28.9784 or -12.34; 56.78
  const coordRegex = /^\s*(-?\d+(?:\.\d+)?)\s*[\s,;]\s*(-?\d+(?:\.\d+)?)\s*$/;

  if (location) {
    const match = location.match(coordRegex);
    if (match) {
      const lat = match[1];
      const lng = match[2];
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    if (location.startsWith("http://") || location.startsWith("https://")) {
      return location;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  }

  if (address) {
    const match = address.match(coordRegex);
    if (match) {
      const lat = match[1];
      const lng = match[2];
      return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  return null;
}

export const WORKFLOW_STATUS_LABELS: Record<string, string> = {
  MEASURED: "Ölçü Alındı",
  QUOTED: "Teklif Verildi",
  ORDERED: "Sipariş Onaylandı",
  PRODUCTION: "Üretimde",
  INSTALLATION: "Montajda",
  COMPLETED: "Tamamlandı"
};

export function getWorkflowStatusLabel(status: string): string {
  return WORKFLOW_STATUS_LABELS[status || 'MEASURED'] || status || 'Ölçü Alındı';
}

export const WORKFLOW_STATUS_COLORS: Record<string, string> = {
  MEASURED: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700",
  QUOTED: "bg-orange-50 text-orange-800 dark:bg-orange-950/20 dark:text-orange-400 border-orange-200 dark:border-orange-900/30",
  ORDERED: "bg-purple-50 text-purple-800 dark:bg-purple-950/20 dark:text-purple-400 border-purple-200 dark:border-purple-900/30",
  PRODUCTION: "bg-red-50 text-red-800 dark:bg-red-950/20 dark:text-red-400 border-red-200 dark:border-red-900/30",
  INSTALLATION: "bg-blue-50 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200 dark:border-blue-900/30",
  COMPLETED: "bg-green-50 text-green-800 dark:bg-green-950/20 dark:text-green-400 border-green-200 dark:border-green-900/30",
};

export function getWorkflowStatusColorClass(status: string): string {
  return WORKFLOW_STATUS_COLORS[status || 'MEASURED'] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700";
}
