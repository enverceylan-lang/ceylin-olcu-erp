export function normalizeText(text: string): string {
  if (!text) return "";
  const map: Record<string, string> = {
    'ç': 'C', 'Ç': 'C',
    'ğ': 'G', 'Ğ': 'G',
    'ı': 'I', 'I': 'I',
    'i': 'I', 'İ': 'I',
    'ö': 'O', 'Ö': 'O',
    'ş': 'S', 'Ş': 'S',
    'ü': 'U', 'Ü': 'U'
  };
  return text.split('').map(char => map[char] || char.toUpperCase()).join('');
}

export function shouldCreateTailorProductionItem(saleItem: any, product?: any): boolean {
  if (!saleItem) return false;

  const pg = (saleItem.productGroup || "").trim();
  const sc = (product?.stockCode || "").trim();

  // Rule: Ürün grup kodu 0002 ile başlıyorsa mekanik/tedarikçi, terziye gitmez.
  if (pg.startsWith("0002") || sc.startsWith("0002")) {
    return false;
  }

  const texts = [
    saleItem.productGroup,
    saleItem.productType,
    product?.stockCode,
    product?.name,
    product?.category
  ].filter(Boolean).map(t => normalizeText(t));

  const isMechanical = texts.some(text =>
    ["STOR", "ZEBRA", "PLICELL", "JALUZI", "AHSAP", "PICASSO", "DIKEY", "MEKANIK"].some(kw => text.includes(kw))
  );

  // If mechanical keyword is matched, it never goes to tailor.
  if (isMechanical) {
    return false;
  }

  const isSewing = texts.some(text =>
    ["TUL", "FON", "GUNESLIK", "KRUVAZE", "REGISTER", "BIRIZ"].some(kw => text.includes(kw))
  );

  if (isSewing) {
    return true;
  }

  // Rule: Ürün grup kodu 0001 ile başlıyorsa ve mekanik değilse terziye gider.
  if (pg.startsWith("0001") || sc.startsWith("0001")) {
    return true;
  }

  return false;
}
