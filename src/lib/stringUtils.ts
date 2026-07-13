export function normalizeCariName(name: string): string {
  if (!name) return "";
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('tr-TR');
}
