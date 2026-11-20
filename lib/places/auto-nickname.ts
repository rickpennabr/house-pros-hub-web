/** Safe in client code. */

type PlaceKind = 'house' | 'business' | 'building';

const SUFFIX: Record<PlaceKind, string> = {
  house: 'Residence',
  business: 'Business',
  building: 'Building',
};

/**
 * A nickname from the street: its first two words after the house number, plus the type.
 * "276 Sunlit Meadow Lane" as a house → "Sunlit Meadow - Residence". Empty without a street.
 */
export function autoNickname(street: string, kind: PlaceKind): string {
  const words = street
    .split(',')[0]
    .trim()
    .split(/\s+/)
    .filter((word) => word && !/^#?\d/.test(word));
  if (words.length === 0) return '';
  return `${words.slice(0, 2).join(' ')} - ${SUFFIX[kind]}`;
}

/**
 * The nickname after the street or type changes: a new automatic one while the nickname is empty
 * or still the automatic one; otherwise what the user typed stays.
 */
export function nextNickname(
  current: string,
  before: { street: string; kind: PlaceKind },
  after: { street: string; kind: PlaceKind }
): string {
  const typed = current.trim();
  if (typed && typed !== autoNickname(before.street, before.kind)) return current;
  return autoNickname(after.street, after.kind);
}
