export function contactDisplayName(contact: {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const display = contact.display_name?.trim();
  if (display) return display;
  const person = [contact.first_name, contact.last_name]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
  if (person) return person;
  const company = contact.company_name?.trim();
  if (company) return company;
  return 'Contact';
}
