/**
 * Route-level loading UI for business routes (e.g. [slug], add, edit).
 */
export default function BusinessLoading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4" aria-hidden>
      <img
        src="/pro-bot-solo-dacing.gif"
        alt=""
        width={56}
        height={56}
        className="h-14 w-14 object-contain object-center"
        aria-label="Loading"
      />
    </div>
  );
}
