/**
 * Shared unit options for product/service line items (invoices, items).
 * Includes general and construction units.
 */
export interface UnitOption {
  value: string;
  label: string;
  group?: 'general' | 'construction';
}

export const UNIT_OPTIONS: UnitOption[] = [
  // General
  { value: 'ea', label: 'ea', group: 'general' },
  { value: 'each', label: 'Each', group: 'general' },
  { value: 'hour', label: 'Hour', group: 'general' },
  { value: 'hours', label: 'Hours', group: 'general' },
  { value: 'day', label: 'Day', group: 'general' },
  { value: 'days', label: 'Days', group: 'general' },
  { value: 'week', label: 'Week', group: 'general' },
  { value: 'weeks', label: 'Weeks', group: 'general' },
  { value: 'month', label: 'Month', group: 'general' },
  { value: 'months', label: 'Months', group: 'general' },
  { value: 'lot', label: 'Lot', group: 'general' },
  { value: 'lb', label: 'Lb', group: 'general' },
  { value: 'lbs', label: 'Lbs', group: 'general' },
  // Construction
  { value: 'sq ft', label: 'Sq ft', group: 'construction' },
  { value: 'linear ft', label: 'Linear ft', group: 'construction' },
  { value: 'cubic yard', label: 'Cubic yard', group: 'construction' },
  { value: 'cy', label: 'CY', group: 'construction' },
  { value: 'ton', label: 'Ton', group: 'construction' },
  { value: 'tons', label: 'Tons', group: 'construction' },
  { value: 'gallon', label: 'Gallon', group: 'construction' },
  { value: 'gallons', label: 'Gallons', group: 'construction' },
  { value: 'piece', label: 'Piece', group: 'construction' },
  { value: 'pieces', label: 'Pieces', group: 'construction' },
  { value: 'box', label: 'Box', group: 'construction' },
  { value: 'boxes', label: 'Boxes', group: 'construction' },
  { value: 'roll', label: 'Roll', group: 'construction' },
  { value: 'rolls', label: 'Rolls', group: 'construction' },
  { value: 'sheet', label: 'Sheet', group: 'construction' },
  { value: 'sheets', label: 'Sheets', group: 'construction' },
  { value: 'bag', label: 'Bag', group: 'construction' },
  { value: 'bags', label: 'Bags', group: 'construction' },
  { value: 'pallet', label: 'Pallet', group: 'construction' },
  { value: 'pallets', label: 'Pallets', group: 'construction' },
];

/** Default unit when none selected */
export const DEFAULT_UNIT = 'each';

/** All values (for quick lookup) */
const UNIT_VALUES = new Set(UNIT_OPTIONS.map((o) => o.value));

export function isKnownUnit(value: string): boolean {
  return UNIT_VALUES.has(value);
}
