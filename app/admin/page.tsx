import Link from 'next/link';

export default function AdminDashboardPage() {
  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-black mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600">
          Welcome to the admin portal. Use the sidebar to navigate to different
          admin functions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-6 border-2 border-black rounded-lg bg-white">
          <h2 className="text-xl font-semibold mb-2">Customers</h2>
          <p className="text-gray-600 mb-4">
            View and manage customer accounts.
          </p>
          <Link href="/admin/customers" className="text-black underline hover:no-underline">
            Go to Customers →
          </Link>
        </div>

        <div className="p-6 border-2 border-black rounded-lg bg-white">
          <h2 className="text-xl font-semibold mb-2">Businesses</h2>
          <p className="text-gray-600 mb-4">
            View and manage business listings.
          </p>
          <Link href="/admin/businesses" className="text-black underline hover:no-underline">
            Go to Businesses →
          </Link>
        </div>

        <div className="p-6 border-2 border-black rounded-lg bg-white">
          <h2 className="text-xl font-semibold mb-2">Clear Data</h2>
          <p className="text-gray-600 mb-4">
            Clear local storage data for testing purposes.
          </p>
          <Link href="/admin/clear-data" className="text-black underline hover:no-underline">
            Go to Clear Data →
          </Link>
        </div>

        <div className="p-6 border-2 border-black rounded-lg bg-white">
          <h2 className="text-xl font-semibold mb-2">Delete Business</h2>
          <p className="text-gray-600 mb-4">
            Delete businesses from local storage.
          </p>
          <Link href="/admin/delete-business" className="text-black underline hover:no-underline">
            Go to Delete Business →
          </Link>
        </div>
      </div>
    </div>
  );
}

