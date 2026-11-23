import type { CrmContactRole } from '@/lib/crm/contact-role';

/** Things you can start from a contact's menu. Edit and Delete are always there. */
export type ContactActionId = 'portal' | 'estimate' | 'invoice' | 'project' | 'addToJob' | 'expense' | 'task';

/** Menu order. */
export const CONTACT_ACTION_ORDER: ContactActionId[] = ['portal', 'estimate', 'invoice', 'project', 'addToJob', 'expense', 'task'];

/** Roles that work on the pro's jobs (they get "Add to a job", never an invoice). */
export const CREW_ROLE_SLUGS = new Set(['employee', 'subcontractor', 'project_manager', 'installer']);

/**
 * Which actions make sense for a contact, from their roles. A contact can hold several roles; the
 * menu is the union.
 * - Customer: portal, estimate, invoice, project, task.
 * - A custom role marked "can invoice": estimate, invoice, task (billed, but not a portal customer).
 * - Supplier: add an expense (a purchase from them) and a task (pickup or delivery).
 * - Employee, subcontractor, project manager: add to a job and a task. Never billed.
 * A contact with no roles (older contacts) is treated as a customer.
 */
export function contactActionsFor(roles: Pick<CrmContactRole, 'slug' | 'can_invoice'>[] | null | undefined): ContactActionId[] {
  const list = roles ?? [];
  const actions = new Set<ContactActionId>();
  if (list.length === 0) {
    for (const id of ['portal', 'estimate', 'invoice', 'project', 'task'] as const) actions.add(id);
  }
  for (const role of list) {
    if (role.slug === 'customer') {
      for (const id of ['portal', 'estimate', 'invoice', 'project', 'task'] as const) actions.add(id);
    } else if (role.slug === 'supplier') {
      actions.add('expense');
      actions.add('task');
    } else if (CREW_ROLE_SLUGS.has(role.slug)) {
      actions.add('addToJob');
      actions.add('task');
    } else if (role.can_invoice) {
      for (const id of ['estimate', 'invoice', 'task'] as const) actions.add(id);
    } else {
      actions.add('task');
    }
  }
  return CONTACT_ACTION_ORDER.filter((id) => actions.has(id));
}

/** The crew role to use when adding this contact to a job (first crew role they hold). */
export function crewRoleOf<T extends Pick<CrmContactRole, 'slug'>>(roles: T[] | null | undefined): T | null {
  return (roles ?? []).find((role) => CREW_ROLE_SLUGS.has(role.slug)) ?? null;
}
