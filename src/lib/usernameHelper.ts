export function normalizeUsername(username: string): string {
  if (!username) return "";
  let clean = username.trim();
  
  // 1. Map Turkish characters (both upper and lowercase) to English equivalents deterministically
  clean = clean.replace(/İ/g, 'i')
               .replace(/ı/g, 'i')
               .replace(/I/g, 'i')
               .replace(/Ş/g, 's')
               .replace(/ş/g, 's')
               .replace(/Ğ/g, 'g')
               .replace(/ğ/g, 'g')
               .replace(/Ü/g, 'u')
               .replace(/ü/g, 'u')
               .replace(/Ö/g, 'o')
               .replace(/ö/g, 'o')
               .replace(/Ç/g, 'c')
               .replace(/ç/g, 'c');

  // 2. Unicode Normalize to NFD (decomposing combining marks)
  clean = clean.normalize("NFD");

  // 3. Remove combining diacritic marks (including U+0307 combining dot above)
  clean = clean.replace(/[\u0300-\u036f]/g, "");

  // 4. Convert to standard lowercase
  clean = clean.toLowerCase();

  // 5. Replace spaces and all other invalid characters with dashes
  // Allowed: a-z, 0-9, dot, underscore, dash
  clean = clean.replace(/[^a-z0-9._-]/g, "-");

  // 6. Simplify consecutive separators (e.g. --- or ___ or ... to single)
  clean = clean.replace(/-+/g, "-")
               .replace(/_+/g, "_")
               .replace(/\.+/g, ".");

  // 7. Clean trailing/leading separators
  clean = clean.replace(/^[-._]+|[-._]+$/g, "");

  return clean;
}
