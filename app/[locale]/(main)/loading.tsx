/**
 * Route-level loading UI for (main) segment (business list, prosuppliers, etc.).
 * Matches the ProBot welcome screen so the transition is seamless: same black bg,
 * white container, centered ProBot + message bubble. Client overlay takes over when ready.
 */
export default function MainLoading() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black md:bg-black/80"
      aria-hidden
      aria-label="Loading"
    >
      {/* Same frame as welcome overlay: white rounded container */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full max-w-[960px] h-[calc(100vh-1rem)] md:min-h-screen md:h-auto md:mt-2 md:rounded-lg border-2 border-black bg-white" />
      </div>
      {/* Centered ProBot only (no message bubble) */}
      <div className="fixed flex items-center justify-center z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[144px] h-[144px]">
        <img
          src="/dance.gif"
          alt=""
          width={144}
          height={144}
          className="w-full h-full object-contain object-center"
        />
      </div>
    </div>
  );
}
