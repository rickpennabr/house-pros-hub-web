import Link from 'next/link';

export default function DeleteBusinessPage() {
  return (
    <div className="w-full max-w-2xl">
      <h1 className="text-3xl font-semibold mb-2">Delete Business</h1>
      <p className="text-gray-700 mb-4">
        Businesses are stored in the database. This screen used to delete a copy that lived only in the browser, so it no longer removes a business.
      </p>
      <Link href="/admin/businesses" className="text-black underline hover:no-underline">
        Open businesses
      </Link>
    </div>
  );
}
