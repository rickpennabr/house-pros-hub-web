/** Red unread count for tabs, cards and banners. Square corners per the shape rules; hidden at 0. */
export function NotificationCount({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-red-600 px-1 text-[11px] font-bold leading-none text-white ${className}`}
      aria-label={`${count} new`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
