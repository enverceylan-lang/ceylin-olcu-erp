import { ChevronDown, ChevronUp, MapPin, Phone } from "lucide-react";

interface CariMobileCustomerSummaryHeaderProps {
  name: string;
  cariTypeLabel: string;
  cariTypeClassName: string;
  phone: string | null;
  locationLabel: string | null;
  expanded: boolean;
  onToggle: () => void;
}

export function CariMobileCustomerSummaryHeader({
  name,
  cariTypeLabel,
  cariTypeClassName,
  phone,
  locationLabel,
  expanded,
  onToggle,
}: CariMobileCustomerSummaryHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-sm font-bold text-gray-900 dark:text-white lg:text-xs lg:uppercase lg:tracking-wide lg:text-gray-500 lg:dark:text-gray-400">
            {name}
            <span className="hidden lg:inline"> · Detaylar</span>
          </h2>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cariTypeClassName}`}
          >
            {cariTypeLabel}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-300"
            >
              <Phone className="h-3.5 w-3.5" />
              {phone}
            </a>
          )}
          {locationLabel && (
            <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-300">
              <MapPin className="h-3.5 w-3.5" />
              {locationLabel}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 lg:hidden"
        aria-label={expanded ? "Müşteri kartını daralt" : "Müşteri kartını genişlet"}
      >
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}