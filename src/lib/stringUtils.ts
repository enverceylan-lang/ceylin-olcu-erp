export function normalizeCariText(value: string): string {
  if (!value) return "";

  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("tr-TR");
}

export function normalizeCariName(name: string): string {
  return normalizeCariText(name);
}

export function normalizeCariAddress(address: string): string {
  return normalizeCariText(address);
}

export function normalizeCariRegion(value: string): string {
  return normalizeCariText(value);
}
