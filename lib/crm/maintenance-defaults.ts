/** Default landscape maintenance chips seeded per owner on first visit open. */
export const DEFAULT_MAINTENANCE_SERVICES: ReadonlyArray<{
  name: string;
  description_template: string;
  sort_order: number;
}> = [
  {
    name: 'Lawn mowing',
    description_template: 'Mowed turf to a clean, even height and bagged or mulched clippings as appropriate.',
    sort_order: 10,
  },
  {
    name: 'Edging',
    description_template: 'Edged walkways, beds, and hardscape borders for a sharp finish.',
    sort_order: 20,
  },
  {
    name: 'Blowing / debris cleanup',
    description_template: 'Blew off hardscape, beds, and turf edges and cleared loose debris from the site.',
    sort_order: 30,
  },
  {
    name: 'Hedge trimming',
    description_template: 'Trimmed hedges and shaped shrubs for a neat, maintained appearance.',
    sort_order: 40,
  },
  {
    name: 'Weed removal',
    description_template: 'Removed weeds from beds, joints, and open soil areas.',
    sort_order: 50,
  },
  {
    name: 'Tree / shrub pruning',
    description_template: 'Pruned trees and shrubs to remove dead growth and improve structure.',
    sort_order: 60,
  },
  {
    name: 'Palm trimming',
    description_template: 'Trimmed palm fronds and cleaned the trunk skirt as needed.',
    sort_order: 70,
  },
  {
    name: 'Mulching',
    description_template: 'Refreshed or redistributed mulch in planting beds for coverage and moisture retention.',
    sort_order: 80,
  },
  {
    name: 'Leaf cleanup',
    description_template: 'Raked and removed leaves from turf, beds, and hardscape.',
    sort_order: 90,
  },
  {
    name: 'Bed maintenance',
    description_template: 'Cleaned and refreshed planting beds, including light plant care.',
    sort_order: 100,
  },
  {
    name: 'Fertilization',
    description_template: 'Applied fertilizer to turf and/or plantings per the maintenance package.',
    sort_order: 110,
  },
  {
    name: 'Irrigation check',
    description_template: 'Checked irrigation coverage, heads, and obvious leaks or dry spots.',
    sort_order: 120,
  },
  {
    name: 'Hardscape rinse',
    description_template: 'Rinsed pavers, concrete, or other hardscape surfaces of dust and clippings.',
    sort_order: 130,
  },
  {
    name: 'Debris haul-off',
    description_template: 'Hauled green waste and job debris off site.',
    sort_order: 140,
  },
  {
    name: 'Seasonal cleanup',
    description_template: 'Completed seasonal landscape cleanup beyond routine weekly maintenance.',
    sort_order: 150,
  },
];

export function buildVisitDescription(input: {
  serviceNames: string[];
  serviceDescriptions: string[];
  notes?: string | null;
  durationSeconds?: number | null;
  breakSeconds?: number | null;
  workerCount?: number | null;
  laborSeconds?: number | null;
  customerName?: string | null;
}): string {
  const lines: string[] = [];
  const who = input.customerName?.trim() || 'the property';
  lines.push(`Landscape maintenance visit completed at ${who}.`);

  if (input.durationSeconds && input.durationSeconds > 0) {
    const hours = Math.floor(input.durationSeconds / 3600);
    const minutes = Math.floor((input.durationSeconds % 3600) / 60);
    const parts = [
      hours > 0 ? `${hours}h` : null,
      `${minutes}m`,
    ].filter(Boolean);
    lines.push(`Time on site: ${parts.join(' ')}.`);
  }

  if (input.breakSeconds && input.breakSeconds > 0) {
    const minutes = Math.max(1, Math.round(input.breakSeconds / 60));
    lines.push(`Breaks: ${minutes}m.`);
  }

  const workers = input.workerCount ?? 1;
  if (workers > 0) {
    const laborHours = ((input.laborSeconds ?? (input.durationSeconds ?? 0) * workers) / 3600).toFixed(2);
    lines.push(`Crew on site: ${workers}. Total labor: ${laborHours} person-hours.`);
  }

  if (input.serviceNames.length > 0) {
    lines.push(`Services completed: ${input.serviceNames.join(', ')}.`);
  }

  for (const description of input.serviceDescriptions) {
    const trimmed = description.trim();
    if (trimmed) lines.push(trimmed);
  }

  const notes = input.notes?.trim();
  if (notes) {
    lines.push('');
    lines.push('Additional notes / out-of-scope observations:');
    lines.push(notes);
  }

  return lines.join('\n');
}

export function formatDurationClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}
