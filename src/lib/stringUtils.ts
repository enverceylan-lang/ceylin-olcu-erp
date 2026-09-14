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
function onlyDigits(value: string, maxLength: number): string {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, maxLength);
}

function groupDigits(
  digits: string,
  groups: readonly number[],
): string {
  const parts: string[] = [];
  let offset = 0;

  for (const size of groups) {
    if (offset >= digits.length) break;
    parts.push(digits.slice(offset, offset + size));
    offset += size;
  }

  return parts.join(" ");
}

export function formatCariPhone(value: string): string {
  return groupDigits(onlyDigits(value, 11), [4, 3, 2, 2]);
}

export function formatCariIdentityNumber(value: string): string {
  return groupDigits(onlyDigits(value, 11), [3, 4, 4]);
}

export function formatCariTaxNumber(value: string): string {
  return groupDigits(onlyDigits(value, 10), [3, 3, 4]);
}
