/** QuickBooks-style name: first name, then last name. */
export function combinedPersonName(first?: string | null, last?: string | null): string {
  return [first, last].map((part) => part?.trim() ?? '').filter(Boolean).join(' ');
}

/** Name already resolved for a list row, with first and last name as the fallback. */
export function listedCustomerName(row: {
  customerDisplayName?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
}): string {
  return row.customerDisplayName?.trim() || combinedPersonName(row.customerFirstName, row.customerLastName);
}

export function contactDisplayName(contact: {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const display = contact.display_name?.trim();
  if (display) return display;
  const person = combinedPersonName(contact.first_name, contact.last_name);
  if (person) return person;
  const company = contact.company_name?.trim();
  if (company) return company;
  return 'Contact';
}
