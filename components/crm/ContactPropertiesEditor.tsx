'use client';

import { useEffect, useState } from 'react';
import { Building, Building2, Home, Pencil, Plus, Trash2 } from 'lucide-react';
import AddressAutocomplete, { type AddressData } from '@/components/AddressAutocomplete';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import type { ContactProperty } from '@/lib/places/contact-places';

type Kind = ContactProperty['kind'];
const KINDS: Kind[] = ['house', 'business', 'building'];
const KIND_LABEL: Record<Kind, string> = { house: 'House', business: 'Business', building: 'Building' };

/** A property typed in the form, before or after it is saved. */
export interface PropertyDraft {
  name: string;
  kind: Kind;
  street: string;
  unit: string;
  city: string;
  state: string;
  zipCode: string;
}

const emptyDraft: PropertyDraft = { name: '', kind: 'house', street: '', unit: '', city: '', state: '', zipCode: '' };

/** House / Business / Building buttons, as on My Places. */
export function PropertyKindPicker({
  value,
  onChange,
  className,
}: {
  value: Kind;
  onChange: (kind: Kind) => void;
  className?: string;
}) {
  return (
    <FormField label="Type" className={className}>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Type">
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={value === kind}
            onClick={() => onChange(kind)}
            className={`rounded-lg border-2 border-black px-2 py-2 text-sm font-medium ${
              value === kind ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'
            }`}
          >
            {KIND_LABEL[kind]}
          </button>
        ))}
      </div>
    </FormField>
  );
}

function KindIcon({ kind }: { kind: Kind }) {
  if (kind === 'business') return <Building2 className="h-5 w-5 text-red-600" aria-hidden />;
  if (kind === 'building') return <Building className="h-5 w-5 text-red-600" aria-hidden />;
  return <Home className="h-5 w-5 text-red-600" aria-hidden />;
}

function addressLine(row: { street: string | null; city: string | null; state: string | null; zipCode: string | null }) {
  return [row.street, row.city, row.state, row.zipCode].filter(Boolean).join(', ');
}

function draftLine(draft: PropertyDraft) {
  const street = [draft.street, draft.unit].filter((part) => part.trim()).join(', ');
  return addressLine({ street, city: draft.city, state: draft.state, zipCode: draft.zipCode });
}

/** Save every draft on a contact that was just created. Returns the first error, if any. */
export async function saveDraftProperties(customerId: string, drafts: PropertyDraft[]): Promise<string | null> {
  for (const draft of drafts) {
    const res = await fetch(`/api/crm/customers/${encodeURIComponent(customerId)}/places`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.error || 'Could not save a property';
    }
  }
  return null;
}

function PropertyFields({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
  error,
  saveLabel,
}: {
  value: PropertyDraft;
  onChange: (next: PropertyDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  saveLabel: string;
}) {
  const set = (key: keyof PropertyDraft, next: string) => onChange({ ...value, [key]: next });
  return (
    <div className="space-y-3 rounded-lg border-2 border-black p-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <PropertyKindPicker value={value.kind} onChange={(kind) => onChange({ ...value, kind })} />
      <FormField label="Nickname" required>
        <Input value={value.name} onChange={(event) => set('name', event.target.value)} placeholder="Main house, Lake house, Rental" />
      </FormField>
      <FormField label="Street" required>
        <AddressAutocomplete
          id={`property-street-${saveLabel}`}
          value={value.street}
          onChange={(street) => set('street', street)}
          onAddressSelect={(address: AddressData) =>
            onChange({
              ...value,
              street: address.streetAddress,
              unit: address.apartment || value.unit,
              city: address.city || value.city,
              state: address.state || value.state,
              zipCode: address.zipCode || value.zipCode,
            })
          }
          placeholder="Search the address"
        />
      </FormField>
      <FormField label="Unit">
        <Input value={value.unit} onChange={(event) => set('unit', event.target.value)} placeholder="Apt, suite, unit" />
      </FormField>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <FormField label="City">
          <Input value={value.city} onChange={(event) => set('city', event.target.value)} placeholder="City" />
        </FormField>
        <FormField label="State">
          <Input value={value.state} onChange={(event) => set('state', event.target.value)} placeholder="State" />
        </FormField>
        <FormField label="ZIP code">
          <Input value={value.zipCode} onChange={(event) => set('zipCode', event.target.value)} placeholder="ZIP" />
        </FormField>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : saveLabel}
        </Button>
      </div>
    </div>
  );
}

function PropertyCard({
  kind,
  name,
  line,
  tags,
  onEdit,
  onRemove,
  disabled,
}: {
  kind: Kind;
  name: string;
  line: string;
  tags: string[];
  onEdit?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border-2 border-black p-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-gray-50">
        <KindIcon kind={kind} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-black">
          {name}
          {tags.map((tag) => (
            <span key={tag} className="ml-2 text-xs font-normal text-gray-500">
              {tag}
            </span>
          ))}
        </span>
        <span className="block truncate text-xs text-gray-600">{line || 'No address'}</span>
      </span>
      {onEdit ? (
        <button type="button" onClick={onEdit} disabled={disabled} aria-label={`Edit ${name}`} className="p-1 disabled:opacity-40">
          <Pencil className="h-4 w-4" />
        </button>
      ) : null}
      {onRemove ? (
        <button type="button" onClick={onRemove} disabled={disabled} aria-label={`Remove ${name}`} className="p-1 text-red-600 disabled:opacity-40">
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </li>
  );
}

/**
 * "Add property" button that saves a new property on a saved contact right away. For pages that
 * pick a property (Add house, estimates) when the one needed is not on the contact yet.
 */
export function AddContactProperty({
  customerId,
  onAdded,
  disabled = false,
}: {
  customerId: string;
  onAdded: (placeId: string) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<PropertyDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return setError('Give the property a nickname.');
    if (!draft.street.trim()) return setError('Enter the street address.');
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/customers/${encodeURIComponent(customerId)}/places`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.id !== 'string') throw new Error(data.error || 'Could not add the property');
      setDraft(null);
      onAdded(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the property');
    } finally {
      setSaving(false);
    }
  };

  if (!draft) {
    return (
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setError(null);
            setDraft({ ...emptyDraft });
          }}
          disabled={disabled}
          className="inline-flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Add property
        </Button>
      </div>
    );
  }
  return (
    <PropertyFields
      value={draft}
      onChange={setDraft}
      onSave={() => void save()}
      onCancel={() => {
        setDraft(null);
        setError(null);
      }}
      saving={saving}
      error={error}
      saveLabel="Add property"
    />
  );
}

type Editing = { key: string; draft: PropertyDraft } | null;

/**
 * The contact's properties, each with a nickname like My Places. With customerId the list is the
 * saved one (My Places the customer shared, plus the ones you added). Without it (a new contact)
 * the properties are drafts the form saves after it creates the contact.
 */
export function ContactPropertiesEditor(
  props: (
    | { customerId: string }
    | { drafts: PropertyDraft[]; onDraftsChange: (drafts: PropertyDraft[]) => void }
  ) & {
    /**
     * The contact's own (billing) address as typed in the form below, shown first. It is the
     * default unless the customer shared a My Places house. Edited in the Billing address fields.
     */
    contactAddress?: { name: string; kind: Kind; line: string } | null;
  }
) {
  const customerId = 'customerId' in props ? props.customerId : null;
  const [loaded, setLoaded] = useState<{ customerId: string; properties: ContactProperty[] } | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    fetch(`/api/crm/customers/${encodeURIComponent(customerId)}/places`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { properties: [] }))
      .then((data: { properties?: ContactProperty[] }) => {
        if (!cancelled) setLoaded({ customerId, properties: Array.isArray(data.properties) ? data.properties : [] });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ customerId, properties: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const saved = customerId && loaded?.customerId === customerId ? loaded.properties : [];
  // The saved contact address is replaced by the one in the form, so it shows unsaved edits.
  const properties = saved.filter((property) => !property.isContactAddress);
  const drafts = 'drafts' in props ? props.drafts : [];
  // A My Places default (customer shared a house) outranks the contact's own address.
  const hasMyPlacesDefault = saved.some((property) => property.isDefault && !property.isContactAddress && !property.addedByPro);
  const contactAddress = props.contactAddress && !hasMyPlacesDefault ? props.contactAddress : null;

  const send = async (method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: PropertyDraft) => {
    if (!customerId) return false;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/customers/${encodeURIComponent(customerId)}/places${path}`, {
        method,
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save the property');
      setLoaded({ customerId, properties: Array.isArray(data.properties) ? data.properties : [] });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the property');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    const { key, draft } = editing;
    if (!draft.name.trim()) return setError('Give the property a nickname.');
    if (!draft.street.trim()) return setError('Enter the street address.');
    if ('drafts' in props) {
      const next = [...props.drafts];
      if (key === 'new') next.push(draft);
      else next[Number(key)] = draft;
      props.onDraftsChange(next);
      setEditing(null);
      setError(null);
      return;
    }
    const ok = key === 'new' ? await send('POST', '', draft) : await send('PATCH', `/${encodeURIComponent(key)}`, draft);
    if (ok) setEditing(null);
  };

  const remove = async (key: string, name: string) => {
    if ('drafts' in props) {
      props.onDraftsChange(props.drafts.filter((_, index) => String(index) !== key));
      return;
    }
    if (!window.confirm(`Remove ${name}? Estimates, invoices and maintenance on it move to the default property.`)) return;
    await send('DELETE', `/${encodeURIComponent(key)}`);
  };

  const startEdit = (key: string, draft: PropertyDraft) => {
    setError(null);
    setEditing({ key, draft });
  };

  const count = (customerId ? properties.length : drafts.length) + (contactAddress ? 1 : 0);
  const formFor = (key: string) =>
    editing?.key === key ? (
      <PropertyFields
        value={editing.draft}
        onChange={(draft) => setEditing({ key, draft })}
        onSave={() => void save()}
        onCancel={() => {
          setEditing(null);
          setError(null);
        }}
        saving={saving}
        error={error}
        saveLabel={key === 'new' ? 'Add property' : 'Save property'}
      />
    ) : null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          Properties <span className="font-normal text-gray-500">· {count}</span>
        </h3>
        <p className="text-xs text-gray-600">
          Houses and buildings you work on for this contact. Give each a nickname; estimates, invoices and maintenance
          pick one. The first is the default.
        </p>
      </div>
      {error && !editing ? <p className="text-sm text-red-600">{error}</p> : null}

      {count > 0 ? (
        <ul className="space-y-2">
          {contactAddress ? (
            <PropertyCard
              kind={contactAddress.kind}
              name={contactAddress.name}
              line={contactAddress.line}
              tags={['Default', 'Billing address']}
            />
          ) : null}
          {customerId
            ? properties.map((property) =>
                editing?.key === property.id ? (
                  <li key={property.id}>{formFor(property.id)}</li>
                ) : (
                  <PropertyCard
                    key={property.id}
                    kind={property.kind}
                    name={property.name}
                    line={addressLine(property)}
                    tags={[
                      property.isDefault && !contactAddress ? 'Default' : '',
                      property.addedByPro ? '' : 'From My Places',
                    ].filter(Boolean)}
                    disabled={saving || Boolean(editing)}
                    onEdit={
                      property.addedByPro
                        ? () =>
                            startEdit(property.id, {
                              name: property.name,
                              kind: property.kind,
                              street: property.street ?? '',
                              unit: '',
                              city: property.city ?? '',
                              state: property.state ?? '',
                              zipCode: property.zipCode ?? '',
                            })
                        : undefined
                    }
                    onRemove={property.addedByPro ? () => void remove(property.id, property.name) : undefined}
                  />
                )
              )
            : drafts.map((draft, index) =>
                editing?.key === String(index) ? (
                  <li key={index}>{formFor(String(index))}</li>
                ) : (
                  <PropertyCard
                    key={index}
                    kind={draft.kind}
                    name={draft.name}
                    line={draftLine(draft)}
                    tags={index === 0 && !contactAddress ? ['Default'] : []}
                    disabled={Boolean(editing)}
                    onEdit={() => startEdit(String(index), draft)}
                    onRemove={() => void remove(String(index), draft.name)}
                  />
                )
              )}
        </ul>
      ) : null}

      {editing?.key === 'new' ? (
        formFor('new')
      ) : (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => startEdit('new', { ...emptyDraft, name: count === 0 ? 'Home' : '' })}
            disabled={saving || Boolean(editing)}
            className="inline-flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            Add property
          </Button>
        </div>
      )}
    </div>
  );
}
