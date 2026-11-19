import type { CrmScope } from '@/lib/crm/crm-scope';
import { contactDisplayName } from '@/lib/crm/contact-name';
import {
  serviceDue,
  toolBookValueCents,
  toolYearlyDepreciationCents,
  type ToolKind,
  type ToolRow,
  type ToolStatus,
} from '@/lib/crm/pro-tools';

/** Shown until migration 144 is applied. */
export const TOOLS_SETUP_ERROR = 'ProTools needs a database update (migration 144) before it can be used.';

export function toolsSchemaMissing(message: string | undefined): boolean {
  return Boolean(message && /pro_crm_tool|tool_id/.test(message) && /does not exist|schema cache|Could not find/i.test(message));
}

/** Check that linked crew, project, and house belong to this business. */
export async function checkToolLinks(
  scope: CrmScope,
  links: { assignedCrewId?: string | null; projectId?: string | null; maintenancePlanId?: string | null }
): Promise<string | null> {
  const db = scope.supabase;
  const checks: Array<Promise<string | null>> = [];
  if (links.assignedCrewId) {
    checks.push(
      Promise.resolve(
        db.from('business_crew_members').select('id').eq('id', links.assignedCrewId).eq('owner_id', scope.ownerId).maybeSingle()
      ).then(({ data }) => (data ? null : 'Crew member not found'))
    );
  }
  if (links.projectId) {
    checks.push(
      Promise.resolve(
        db.from('pro_crm_projects').select('id').eq('id', links.projectId).eq('owner_id', scope.ownerId).maybeSingle()
      ).then(({ data }) => (data ? null : 'Project not found'))
    );
  }
  if (links.maintenancePlanId) {
    checks.push(
      Promise.resolve(
        db.from('pro_crm_maintenance_plans').select('id').eq('id', links.maintenancePlanId).eq('owner_id', scope.ownerId).maybeSingle()
      ).then(({ data }) => (data ? null : 'Maintenance house not found'))
    );
  }
  const errors = await Promise.all(checks);
  return errors.find(Boolean) ?? null;
}

export interface ToolNames {
  crew: Map<string, string>;
  projects: Map<string, string>;
  houses: Map<string, string>;
}

/** Names for the people, projects, and houses tools point at. */
export async function loadToolNames(
  scope: CrmScope,
  rows: Array<{ assigned_crew_id: string | null; project_id: string | null; maintenance_plan_id: string | null }>
): Promise<ToolNames> {
  const db = scope.supabase;
  const ids = (key: 'assigned_crew_id' | 'project_id' | 'maintenance_plan_id') =>
    [...new Set(rows.map((row) => row[key]).filter(Boolean))] as string[];
  const crewIds = ids('assigned_crew_id');
  const projectIds = ids('project_id');
  const planIds = ids('maintenance_plan_id');

  const [crewRes, projectRes, planRes] = await Promise.all([
    crewIds.length ? db.from('business_crew_members').select('id, display_name').in('id', crewIds) : Promise.resolve({ data: [] }),
    projectIds.length ? db.from('pro_crm_projects').select('id, name').in('id', projectIds) : Promise.resolve({ data: [] }),
    planIds.length ? db.from('pro_crm_maintenance_plans').select('id, name, customer_id').in('id', planIds) : Promise.resolve({ data: [] }),
  ]);
  const plans = (planRes.data ?? []) as Array<{ id: string; name: string; customer_id: string }>;
  const customerIds = [...new Set(plans.map((plan) => plan.customer_id))];
  const { data: customers } = customerIds.length
    ? await db.from('pro_crm_customers').select('id, first_name, last_name, display_name, company_name').in('id', customerIds)
    : { data: [] };
  const customerName = new Map(
    ((customers ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null; display_name: string | null; company_name: string | null }>).map(
      (customer) => [customer.id, contactDisplayName(customer)]
    )
  );

  return {
    crew: new Map(((crewRes.data ?? []) as Array<{ id: string; display_name: string }>).map((row) => [row.id, row.display_name])),
    projects: new Map(((projectRes.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name])),
    houses: new Map(plans.map((plan) => [plan.id, customerName.get(plan.customer_id) ?? plan.name])),
  };
}

export interface ToolListItem {
  id: string;
  kind: ToolKind;
  name: string;
  category: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  quantity: number;
  status: ToolStatus;
  purchaseDate: string | null;
  purchaseCents: number;
  bookValueCents: number;
  /** Purchase plus every expense filed on the item. */
  totalCostCents: number;
  assignedCrewId: string | null;
  assignedTo: string | null;
  projectId: string | null;
  projectName: string | null;
  maintenancePlanId: string | null;
  houseName: string | null;
  location: string | null;
  nextServiceDate: string | null;
  serviceDue: 'overdue' | 'soon' | null;
  photoUrl: string | null;
  updatedAt: string;
}

export function toListItem(
  row: ToolRow,
  names: ToolNames,
  today: string,
  extraCostCents: number,
  photoUrl: string | null
): ToolListItem {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    category: row.category,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serial_number,
    quantity: row.quantity,
    status: row.status,
    purchaseDate: row.purchase_date,
    purchaseCents: row.purchase_cents,
    bookValueCents: toolBookValueCents(row, today),
    totalCostCents: row.purchase_cents + extraCostCents,
    assignedCrewId: row.assigned_crew_id,
    assignedTo: row.assigned_crew_id ? names.crew.get(row.assigned_crew_id) ?? null : null,
    projectId: row.project_id,
    projectName: row.project_id ? names.projects.get(row.project_id) ?? null : null,
    maintenancePlanId: row.maintenance_plan_id,
    houseName: row.maintenance_plan_id ? names.houses.get(row.maintenance_plan_id) ?? null : null,
    location: row.location,
    nextServiceDate: row.next_service_date,
    serviceDue: row.status === 'retired' || row.status === 'lost' ? null : serviceDue(row.next_service_date, today),
    photoUrl,
    updatedAt: row.updated_at,
  };
}

export interface ToolsSummary {
  itemCount: number;
  activeCount: number;
  purchaseCents: number;
  bookValueCents: number;
  yearlyDepreciationCents: number;
  upkeepCents: number;
  serviceDueCount: number;
  byStatus: Record<ToolStatus, number>;
  byCategory: Array<{ category: string; count: number; purchaseCents: number; bookValueCents: number }>;
}

export function summarizeTools(rows: ToolRow[], today: string, upkeepByTool: Map<string, number>): ToolsSummary {
  const byStatus: Record<ToolStatus, number> = { available: 0, in_use: 0, repair: 0, retired: 0, lost: 0 };
  const categories = new Map<string, { count: number; purchaseCents: number; bookValueCents: number }>();
  let purchaseCents = 0;
  let bookValueCents = 0;
  let yearlyDepreciationCents = 0;
  let upkeepCents = 0;
  let serviceDueCount = 0;

  for (const row of rows) {
    byStatus[row.status] += 1;
    const active = row.status !== 'retired' && row.status !== 'lost';
    const value = toolBookValueCents(row, today);
    purchaseCents += row.purchase_cents;
    bookValueCents += value;
    upkeepCents += upkeepByTool.get(row.id) ?? 0;
    if (active) {
      if (value > Math.min(row.salvage_cents, row.purchase_cents)) yearlyDepreciationCents += toolYearlyDepreciationCents(row);
      if (serviceDue(row.next_service_date, today)) serviceDueCount += 1;
    }
    const key = row.category || (row.kind === 'equipment' ? 'Equipment' : 'Tools');
    const entry = categories.get(key) ?? { count: 0, purchaseCents: 0, bookValueCents: 0 };
    entry.count += row.quantity;
    entry.purchaseCents += row.purchase_cents;
    entry.bookValueCents += value;
    categories.set(key, entry);
  }

  return {
    itemCount: rows.reduce((sum, row) => sum + row.quantity, 0),
    activeCount: rows.filter((row) => row.status !== 'retired' && row.status !== 'lost').length,
    purchaseCents,
    bookValueCents,
    yearlyDepreciationCents,
    upkeepCents,
    serviceDueCount,
    byStatus,
    byCategory: [...categories.entries()]
      .map(([category, entry]) => ({ category, ...entry }))
      .sort((a, b) => b.bookValueCents - a.bookValueCents),
  };
}

/** Sum of expenses filed on each tool, leaving out the purchase expense itself. */
export async function loadUpkeepByTool(scope: CrmScope, toolIds: string[]): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (toolIds.length === 0) return totals;
  const { data } = await scope.supabase
    .from('pro_crm_expenses')
    .select('tool_id, amount_cents, note')
    .eq('owner_id', scope.ownerId)
    .in('tool_id', toolIds);
  for (const row of (data ?? []) as Array<{ tool_id: string; amount_cents: number; note: string | null }>) {
    if (row.note === PURCHASE_NOTE) continue;
    totals.set(row.tool_id, (totals.get(row.tool_id) ?? 0) + row.amount_cents);
  }
  return totals;
}

/** Marks the expense created when an item is bought, so it is not counted twice as upkeep. */
export const PURCHASE_NOTE = 'ProTools purchase';

export async function recordToolEvent(
  scope: CrmScope,
  toolId: string,
  event: {
    status?: string | null;
    assigned_crew_id?: string | null;
    project_id?: string | null;
    maintenance_plan_id?: string | null;
    note?: string | null;
  }
) {
  await scope.supabase.from('pro_crm_tool_events').insert({
    tool_id: toolId,
    owner_id: scope.ownerId,
    actor_id: scope.actorId,
    ...event,
  });
}
