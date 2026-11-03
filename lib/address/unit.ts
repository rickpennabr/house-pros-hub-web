const UNIT_TAIL =
  /(?:,|\s)+((?:apt|apartment|unit|ste|suite|bldg|building|fl|floor|rm|room|#)\.?)\s*#?\s*([A-Za-z0-9][A-Za-z0-9-]{0,11})\s*$/i;

/** Pull a unit off the end of a street line, such as "123 Main St, Apt 4". */
export function splitUnit(line: string): { street: string; unit: string } {
  const trimmed = line.trim();
  const match = trimmed.match(UNIT_TAIL);
  if (!match || match.index == null) return { street: trimmed, unit: '' };
  const label = match[1].replace(/\.$/, '');
  const unit = label === '#' ? `#${match[2]}` : `${label} ${match[2]}`;
  return {
    street: trimmed.slice(0, match.index).replace(/[,\s]+$/, ''),
    unit,
  };
}

/** One mailing line, with the unit kept when the street does not already include it. */
export function joinMailLine(street: string, unit: string): string {
  const line = street.trim();
  const extra = unit.trim();
  if (!extra) return line;
  if (!line) return extra;
  if (line.toLowerCase().includes(extra.toLowerCase())) return line;
  return `${line}, ${extra}`;
}

/** Compare streets without the unit, so "123 Main St" matches "123 Main St, Apt 4". */
export function mailStreetKey(value: string | null | undefined): string {
  return splitUnit(value ?? '')
    .street.toLowerCase()
    .replace(/[.,#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
