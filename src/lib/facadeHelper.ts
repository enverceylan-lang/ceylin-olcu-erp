import { generateUUID } from "@/store/useStore";

export type FacadeType = 'WALL' | 'GLASS' | 'WINDOW' | 'DOOR';

export interface FacadeSegment {
  id: string;
  order: number;
  widthCm: number;
  type: FacadeType;
  label: string;
  note?: string;
}

export const FACADE_TYPE_MAP: Record<string, { type: FacadeType, label: string }> = {
  d: { type: 'WALL', label: 'Duvar' },
  duvar: { type: 'WALL', label: 'Duvar' },
  c: { type: 'GLASS', label: 'Cam' },
  cam: { type: 'GLASS', label: 'Cam' },
  p: { type: 'WINDOW', label: 'Pencere' },
  pencere: { type: 'WINDOW', label: 'Pencere' },
  k: { type: 'DOOR', label: 'Kapı' },
  kapi: { type: 'DOOR', label: 'Kapı' },
  kapı: { type: 'DOOR', label: 'Kapı' },
};

export const TYPE_TO_LABEL: Record<FacadeType, string> = {
  WALL: 'Duvar',
  GLASS: 'Cam',
  WINDOW: 'Pencere',
  DOOR: 'Kapı',
};

export function parseFacadeInput(input: string): { segments: FacadeSegment[], errors: string[] } {
  const segments: FacadeSegment[] = [];
  const errors: string[] = [];
  
  if (!input || !input.trim()) {
    return { segments, errors };
  }

  // Regex to match numbers (including decimals with dot or comma) and following word
  // e.g. "60.5 D" or "60,5D" or "70 Cam"
  // It handles optional spaces between number and word.
  const regex = /([\d.,]+)\s*([a-zA-ZçÇğĞıİöÖşŞüÜ]+)/g;
  let match;
  let lastIndex = 0;
  let order = 1;

  while ((match = regex.exec(input)) !== null) {
    const rawNumber = match[1];
    const rawCode = match[2];
    
    // Validate number
    const normalizedNumber = rawNumber.replace(',', '.');
    const widthCm = parseFloat(normalizedNumber);

    const normalizedCode = rawCode.toLowerCase();
    const mapped = FACADE_TYPE_MAP[normalizedCode];

    if (isNaN(widthCm) || widthCm <= 0) {
      errors.push(`Geçersiz ölçü: ${rawNumber}`);
      continue;
    }

    if (!mapped) {
      errors.push(`Bilinmeyen kod veya tür: ${rawCode}`);
      continue;
    }

    segments.push({
      id: generateUUID(),
      order: order++,
      widthCm,
      type: mapped.type,
      label: mapped.label,
    });

    lastIndex = regex.lastIndex;
  }

  // Check if there's any unparsed junk at the end or anywhere
  const stripped = input.replace(regex, '').replace(/\s/g, '');
  if (stripped.length > 0 && segments.length === 0) {
    errors.push("Girdi anlaşılamadı. Format: '60 D 70 C' veya '60 duvar 70 cam' şeklinde olmalıdır.");
  } else if (stripped.length > 0) {
    // maybe there's extra stuff, we can just warn
    errors.push(`Bazı kısımlar anlaşılamadı: "${stripped}"`);
  }

  return { segments, errors };
}

export function formatFacadeForReport(segments: FacadeSegment[]): string {
  if (!segments || segments.length === 0) return "";
  
  const shortFormat = segments.map(s => `[${s.label[0]} ${s.widthCm}]`).join(" ");
  const longFormat = segments.map(s => `${s.label} ${s.widthCm}`).join(" + ");
  const total = segments.reduce((sum, s) => sum + (s.widthCm > 0 ? s.widthCm : 0), 0);
  
  return `CEPHE EN DİZİLİMİ\n${shortFormat}\n\nAçılım:\n${longFormat}`;
}
