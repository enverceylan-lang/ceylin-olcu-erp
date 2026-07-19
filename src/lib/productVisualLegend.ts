export interface ProductVisualLegendItem {
  productType: string;
  label: string;
  color: string;
  lineWidth: number;
  doubleLine?: boolean;
}

export const PRODUCT_VISUAL_LEGEND: Record<
  string,
  ProductVisualLegendItem
> = {
  TUL: {
    productType: 'TUL',
    label: 'Tül',
    color: '#111111',
    lineWidth: 4,
    doubleLine: true
  },

  TAVAN_RUSTIK: {
    productType: 'TAVAN_RUSTIK',
    label: 'Tavan Rustik',
    color: '#2563eb',
    lineWidth: 5
  },

  GUNESLIK: {
    productType: 'GUNESLIK',
    label: 'Güneşlik',
    color: '#f97316',
    lineWidth: 4
  },

  FON: {
    productType: 'FON',
    label: 'Fon',
    color: '#991b1b',
    lineWidth: 5
  },

  STOR: {
    productType: 'STOR',
    label: 'Stor',
    color: '#16a34a',
    lineWidth: 4
  },

  ZEBRA: {
    productType: 'ZEBRA',
    label: 'Zebra',
    color: '#7e22ce',
    lineWidth: 4
  },

  PLICELL: {
    productType: 'PLICELL',
    label: 'Plicell',
    color: '#ec4899',
    lineWidth: 4
  },

  DIKEY_TUL: {
    productType: 'DIKEY_TUL',
    label: 'Dikey Tül',
    color: '#eab308',
    lineWidth: 4
  },

  DIKEY_STOR: {
    productType: 'DIKEY_STOR',
    label: 'Dikey Stor',
    color: '#0891b2',
    lineWidth: 4
  },

  AHSAP_JALUZI: {
    productType: 'AHSAP_JALUZI',
    label: 'Ahşap Jaluzi',
    color: '#92400e',
    lineWidth: 4
  },

  JALUZI: {
    productType: 'JALUZI',
    label: 'Jaluzi',
    color: '#64748b',
    lineWidth: 4
  },

  METAL_JALUZI: {
    productType: 'METAL_JALUZI',
    label: 'Metal Jaluzi',
    color: '#64748b',
    lineWidth: 4
  },

  PICASSO: {
    productType: 'PICASSO',
    label: 'Picasso',
    color: '#c026d3',
    lineWidth: 4
  },

  RUSTIK: {
    productType: 'RUSTIK',
    label: 'Rustik',
    color: '#78350f',
    lineWidth: 4
  }
};

export function getProductVisualLegendItems(
  productTypes: string[] | undefined
): ProductVisualLegendItem[] {
  const uniqueTypes =
    Array.from(
      new Set(
        (productTypes || [])
          .map(type =>
            String(type || '')
              .trim()
              .toUpperCase()
          )
          .filter(Boolean)
      )
    );

  return uniqueTypes
    .map(type => PRODUCT_VISUAL_LEGEND[type])
    .filter(
      (
        item
      ): item is ProductVisualLegendItem =>
        Boolean(item)
    );
}
