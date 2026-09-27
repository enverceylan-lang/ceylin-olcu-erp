import { MapPin, Phone } from "lucide-react";

interface CariCustomerDesktopContactSummaryProps {
  phone: string | null;
  locationLabel: string;
  addressText: string;
  customerCode: string;
  taxNumber: string;
  cariTypeLabel: string;
  metadataLocationLabel: string;
}

export function CariCustomerDesktopContactSummary({
  phone,
  locationLabel,
  addressText,
  customerCode,
  taxNumber,
  cariTypeLabel,
  metadataLocationLabel,
}: CariCustomerDesktopContactSummaryProps) {
  return (
    <div className="mt-2 grid max-w-3xl gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2 xl:grid-cols-[auto_1fr]">
      <div className="flex min-w-0 items-center gap-2">
        <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        {phone ? (
          <a href={`tel:${phone}`} className="truncate font-semibold hover:text-blue-600 hover:underline dark:hover:text-blue-300">
            {phone}
          </a>
        ) : (
          <span className="text-gray-400">Telefon belirtilmemiş</span>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="truncate font-semibold text-blue-600 dark:text-blue-300">
          {locationLabel}
        </span>
      </div>

      <div className="flex min-w-0 items-start gap-2 sm:col-span-2 xl:col-span-2">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="line-clamp-2 font-medium leading-relaxed text-gray-500 dark:text-gray-400">{addressText}</span>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-gray-200/80 bg-gray-50/70 p-3 text-sm dark:border-gray-800 dark:bg-gray-950/30 sm:col-span-2 sm:grid-cols-4 xl:col-span-2">
        <div>
          <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">Müşteri No</span>
          <span className="mt-0.5 block truncate font-mono font-semibold text-gray-700 dark:text-gray-200">{customerCode}</span>
        </div>
        <div>
          <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">Vergi No</span>
          <span className="mt-0.5 block truncate font-mono font-semibold text-gray-700 dark:text-gray-200">{taxNumber}</span>
        </div>
        <div>
          <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">Grup</span>
          <span className="mt-0.5 block truncate font-semibold text-gray-700 dark:text-gray-200">{cariTypeLabel}</span>
        </div>
        <div>
          <span className="block text-[9px] font-bold uppercase tracking-wider text-gray-400">İl / İlçe</span>
          <span className="mt-0.5 block truncate font-semibold text-gray-700 dark:text-gray-200">{metadataLocationLabel}</span>
        </div>
      </div>
    </div>
  );
}
