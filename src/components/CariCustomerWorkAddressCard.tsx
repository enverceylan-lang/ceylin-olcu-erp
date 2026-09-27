interface CariCustomerWorkAddressOption {
  id: string;
  label: string;
}

interface CariCustomerWorkAddressCardProps {
  provinceDistrictLabel: string;
  selectedAddressId: string | null;
  addressOptions: readonly CariCustomerWorkAddressOption[];
  emptyAddressLabel: string;
  selectedAddressText: string | null;
  canEdit: boolean;
  onAddressChange: (addressId: string | null) => void;
  onEditAddress: () => void;
}

export function CariCustomerWorkAddressCard({
  provinceDistrictLabel,
  selectedAddressId,
  addressOptions,
  emptyAddressLabel,
  selectedAddressText,
  canEdit,
  onAddressChange,
  onEditAddress,
}: CariCustomerWorkAddressCardProps) {
  return (
    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Ölçü / İş Adresi
        </span>
        <span className="truncate text-[10px] font-semibold text-gray-500 dark:text-gray-400">
          {provinceDistrictLabel}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <select
          value={selectedAddressId || ""}
          onChange={(event) => onAddressChange(event.target.value || null)}
          disabled={addressOptions.length === 0}
          className="min-h-9 w-full rounded-lg border border-blue-200 bg-white px-3 text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:border-blue-900/60 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800"
        >
          {addressOptions.length === 0 ? (
            <option value="">{emptyAddressLabel}</option>
          ) : (
            addressOptions.map((address) => (
              <option key={address.id} value={address.id}>
                {address.label}
              </option>
            ))
          )}
        </select>

        {canEdit && (
          <button
            type="button"
            onClick={onEditAddress}
            className="min-h-9 rounded-lg border border-blue-200 bg-white px-3 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-gray-900 dark:text-blue-300"
          >
            Adres Değiştir
          </button>
        )}
      </div>

      <div className="mt-2 line-clamp-2 text-xs font-medium text-gray-600 dark:text-gray-300">
        {selectedAddressText || "Adres belirtilmemiş"}
      </div>
    </div>
  );
}