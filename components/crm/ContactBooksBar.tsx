import { formatAmount } from '@/lib/invoices/format';
import type { ContactBooksSummary, MoneyBucket } from '@/lib/crm/contact-books';

interface ContactBooksBarProps {
  books: ContactBooksSummary;
}

function countLabel(bucket: MoneyBucket, singular: string, plural: string): string {
  return `${bucket.count} ${bucket.count === 1 ? singular : plural}`;
}

function Stat({ label, bucket, detail }: { label: string; bucket: MoneyBucket; detail: string }) {
  return (
    <div className="rounded-lg border-2 border-black bg-white px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-semibold text-black">{formatAmount(bucket.cents)}</p>
      <p className="text-xs text-gray-500">{detail}</p>
    </div>
  );
}

export function ContactBooksBar({ books }: ContactBooksBarProps) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:pb-3">
      <Stat label="Estimates" bucket={books.estimates} detail={countLabel(books.estimates, 'open', 'open')} />
      <Stat label="Overdue" bucket={books.overdue} detail={countLabel(books.overdue, 'invoice', 'invoices')} />
      <Stat label="Open invoices" bucket={books.openInvoices} detail={countLabel(books.openInvoices, 'invoice', 'invoices')} />
      <Stat label="Recently paid" bucket={books.recentlyPaid} detail={countLabel(books.recentlyPaid, 'payment', 'payments')} />
    </div>
  );
}
