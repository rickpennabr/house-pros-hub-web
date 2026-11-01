/**
 * Page-slot loader for the main shell.
 * Stays in the content area so the header and main menu remain visible
 * while a route such as ProProducts fetches its data.
 */
export default function MainLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-16" role="status" aria-label="Loading">
      <p className="text-sm text-gray-600">Loading</p>
    </div>
  );
}
