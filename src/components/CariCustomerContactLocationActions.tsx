import { Edit, Loader2, MapPin, Phone } from "lucide-react";

interface CariCustomerContactLocationActionsProps {
  phone: string | null;
  mapsUrl: string | null;
  hasMapLocation: boolean;
  updatingLocation: boolean;
  canEdit: boolean;
  onUpdateLocation: () => void;
  onEdit: () => void;
}

export function CariCustomerContactLocationActions({
  phone,
  mapsUrl,
  hasMapLocation,
  updatingLocation,
  canEdit,
  onUpdateLocation,
  onEdit,
}: CariCustomerContactLocationActionsProps) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {phone && (
        <a
          href={`tel:${phone}`}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750"
        >
          <Phone className="h-3.5 w-3.5" />
          Ara
        </a>
      )}

      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750"
        >
          <MapPin className="h-3.5 w-3.5" />
          Harita
        </a>
      )}

      <button
        type="button"
        onClick={onUpdateLocation}
        disabled={updatingLocation}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750"
      >
        {updatingLocation ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <MapPin className="h-3.5 w-3.5" />
        )}
        {hasMapLocation ? "Konum Güncelle" : "Konum Al"}
      </button>

      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-750"
        >
          <Edit className="h-3.5 w-3.5" />
          Cariyi Düzenle
        </button>
      )}
    </div>
  );
}