interface CariCustomerIdentityHeaderProps {
  name: string;
  cariTypeLabel: string;
  cariTypeClassName: string;
  customerCode: string | null;
}

export function CariCustomerIdentityHeader({
  name,
  cariTypeLabel,
  cariTypeClassName,
  customerCode,
}: CariCustomerIdentityHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="truncate text-2xl font-extrabold tracking-tight heading-title sm:text-3xl">
        {name}
      </h1>
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${cariTypeClassName}`}
      >
        {cariTypeLabel}
      </span>
      {customerCode && (
        <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          {customerCode}
        </span>
      )}
    </div>
  );
}