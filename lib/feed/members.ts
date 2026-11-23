/** Kinds where the customer is the target of the post (the pro acts on them). */
const CUSTOMER_TARGET_KINDS = new Set<string>(['estimate_sent', 'project_scheduled', 'project_photos']);

/**
 * Only people who signed up for the Hub appear in HubFeed. A pro's CRM contact without a Hub
 * account, a guest estimate request, or feedback without an account is never shown.
 * Mirrors public.hub_feed_row_is_hub_member (migration 162), which enforces the same rule on insert.
 */
export function isHubMemberRow(row: { kind: string; actor_user_id: string | null; target_user_id: string | null }): boolean {
  return CUSTOMER_TARGET_KINDS.has(row.kind) ? !!row.target_user_id : !!row.actor_user_id;
}
