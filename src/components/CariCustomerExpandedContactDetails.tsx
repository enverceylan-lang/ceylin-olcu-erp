import { MapPin, Phone } from "lucide-react";

export interface CariCustomerExpandedContactData {
  taxNumber: string | null;
  phone: string | null;
  phone2: string | null;
  provinceDistrictLabel: string | null;
  mapsUrl: string | null;
  addressDisplayText: string;
}

interface CariCustomerExpandedContactDetailsProps {
  customerCode: string | null;
  contactDetails: CariCustomerExpandedContactData | null;
}

export function CariCustomerExpandedContactDetails({
  customerCode,
  contactDetails,
}: CariCustomerExpandedContactDetailsProps) {
  return (
    <>
      {customerCode && (
        <div className="py-3">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Cari Kodu
          </span>
          <span className="mt-1 block break-all font-mono text-sm font-semibold text-gray-900 dark:text-white">
            {customerCode}
          </span>
        </div>
      )}

      {contactDetails?.taxNumber && (
        <div className="py-3">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            TC / Vergi No
          </span>
          <span className="mt-1 block font-mono text-sm font-semibold text-gray-900 dark:text-white">
            {contactDetails.taxNumber}
          </span>
        </div>
      )}

      {contactDetails && (
        <div className="py-2.5">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Telefon
              </span>
              {contactDetails.phone ? (
                <a
                  href={`tel:${contactDetails.phone}`}
                  className="mt-0.5 inline-flex min-h-6 items-center font-semibold text-gray-900 hover:text-blue-700 hover:underline dark:text-gray-100 dark:hover:text-blue-300"
                >
                  {contactDetails.phone}
                </a>
              ) : (
                <span className="mt-0.5 block text-gray-400">Belirtilmemiş</span>
              )}
            </div>
          </div>
        </div>
      )}

      {contactDetails?.phone2 && (
        <div className="py-3">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Telefon 2
          </span>
          <a
            href={`tel:${contactDetails.phone2}`}
            className="mt-1 inline-flex min-h-8 items-center font-bold text-blue-700 hover:underline dark:text-blue-300"
          >
            {contactDetails.phone2}
          </a>
        </div>
      )}

      {contactDetails && (
        <div className="py-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Adres
            </span>
            {contactDetails.provinceDistrictLabel && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                {contactDetails.provinceDistrictLabel}
              </span>
            )}
          </div>

          {contactDetails.mapsUrl ? (
            <a
              href={contactDetails.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex min-h-9 items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/70 p-2 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-950/40"
              title="Haritada Göster"
            >
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
              <span className="break-words group-hover:underline">
                {contactDetails.addressDisplayText}
              </span>
            </a>
          ) : (
            <div
              className="flex cursor-not-allowed items-start gap-1.5 text-gray-400 dark:text-gray-600"
              title="Konum eklenmemiş"
            >
              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-300 dark:text-gray-700" />
              <span className="break-words">{contactDetails.addressDisplayText}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}