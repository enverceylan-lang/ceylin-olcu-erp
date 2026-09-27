import { Edit, MapPin, Phone } from "lucide-react";

interface CariCustomerMobileQuickActionsProps {
  phone: string | null;
  mapsUrl: string | null;
  canEdit: boolean;
  onEdit: () => void;
}

export function CariCustomerMobileQuickActions({
  phone,
  mapsUrl,
  canEdit,
  onEdit,
}: CariCustomerMobileQuickActionsProps) {
  return (
    <div className="mt-2 flex items-center gap-1.5 lg:hidden">
      {phone && (
        <a
          href={`tel:${phone}`}
          title="Ara"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
        >
          <Phone className="h-4 w-4" />
        </a>
      )}

      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Haritada Aç"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          <MapPin className="h-4 w-4" />
        </a>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Cariyi Düzenle"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300"
        >
          <Edit className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}