import type { CustomerAddress } from '@/store/useStore';

export const CUSTOMER_ADDRESS_TITLE_REQUIRED_MESSAGE =
  'Bu caride birden fazla adres bulunduğu için yeni adres için Adres Başlığı girilmelidir. Örn: Ev, İş, Yazlık, Yeni Ev.';

export function duplicateCustomerAddressTitleMessage(title: string): string {
  return `Bu caride ‘${String(title || '').trim()}’ başlığı daha önce kullanılmış. Karışıklık olmaması için farklı bir başlık girin.`;
}

export function normalizeCustomerAddressSearchText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/\s+/g, ' ');
}

export function normalizeCustomerAddressTitle(value: unknown): string {
  return normalizeCustomerAddressSearchText(value);
}

export function activeCustomerAddresses(
  addresses: CustomerAddress[] | null | undefined,
): CustomerAddress[] {
  return (addresses || []).filter(address => !address.isDeleted);
}

export function validateCustomerAddressTitle(
  addresses: CustomerAddress[] | null | undefined,
  input: {
    id?: string;
    title?: string;
  },
): { ok: true; normalizedTitle?: string } | { ok: false; message: string } {
  const active = activeCustomerAddresses(addresses);
  const title = String(input.title || '').trim();
  const normalizedTitle = normalizeCustomerAddressTitle(title);

  const otherActive = active.filter(address => address.id !== input.id);
  const resultingActiveCount =
    input.id && active.some(address => address.id === input.id)
      ? active.length
      : active.length + 1;

  const otherActiveHasBlankTitle = otherActive.some(
    address =>
      !normalizeCustomerAddressTitle(
        address.normalizedTitle || address.title,
      ),
  );

  if (
    resultingActiveCount > 1 &&
    (!normalizedTitle || otherActiveHasBlankTitle)
  ) {
    return {
      ok: false,
      message: CUSTOMER_ADDRESS_TITLE_REQUIRED_MESSAGE,
    };
  }

  if (
    normalizedTitle &&
    otherActive.some(
      address =>
        normalizeCustomerAddressTitle(
          address.normalizedTitle || address.title,
        ) === normalizedTitle,
    )
  ) {
    return {
      ok: false,
      message: duplicateCustomerAddressTitleMessage(title),
    };
  }

  return normalizedTitle
    ? { ok: true, normalizedTitle }
    : { ok: true };
}

export function customerAddressDisplayTitle(
  address: Pick<CustomerAddress, 'title'> | null | undefined,
): string {
  const title = String(address?.title || '').trim();
  return title || 'Belirtilmemiş';
}