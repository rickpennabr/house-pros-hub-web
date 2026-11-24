/** Count next to a CRM page title (Contacts 8, Invoices 3). Hidden until the number is known. */
export function TitleCount({ count }: { count: number | null | undefined }) {
  if (count === null || count === undefined) return null;
  return (
    <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border-2 border-black bg-white px-1 text-xs font-semibold text-black">
      {count}
    </span>
  );
}
