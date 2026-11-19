"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { TypingSearchInput } from "@/components/common/TypingSearchInput";
import { CustomerForm, emptyForm } from "@/components/crm/CustomerForm";
import {
  EMPTY_HOUSE_AGREEMENT,
  HouseAgreementForm,
  houseAgreementError,
  houseAgreementPayload,
  type HouseAgreementValues,
} from "@/components/maintenance/HouseAgreementForm";
import { contactDisplayName } from "@/lib/crm/contact-name";
import type { ContactProperty } from "@/lib/places/contact-places";

async function loadContacts(): Promise<ContactOption[]> {
  try {
    const res = await fetch(
      "/api/crm/customers?pageSize=500&sortBy=updated_at&sortDir=desc",
      { credentials: "include" },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.customers ?? [];
  } catch {
    return [];
  }
}

interface ContactOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name?: string | null;
  company_name?: string | null;
  street_address?: string | null;
  apartment?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}

function contactAddress(contact: ContactOption | undefined) {
  if (!contact) return "";
  return [
    contact.street_address,
    contact.apartment,
    contact.city,
    contact.state,
    contact.zip_code,
  ]
    .filter(Boolean)
    .join(", ");
}

export default function AddMaintenanceHousePage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const backHref = `/${locale}/crm/maintenance`;

  const [contacts, setContacts] = useState<ContactOption[] | null>(null);
  const [contactFilter, setContactFilter] = useState("");
  const [customerId, setCustomerId] = useState(
    searchParams.get("customerId") || "",
  );
  const [values, setValues] = useState<HouseAgreementValues>(
    EMPTY_HOUSE_AGREEMENT,
  );
  const [properties, setProperties] = useState<ContactProperty[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingHouseId, setExistingHouseId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadContacts().then((list) => !cancelled && setContacts(list));
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleContacts = useMemo(() => {
    const query = contactFilter.trim().toLowerCase();
    const list = contacts ?? [];
    const matches = query
      ? list.filter((contact) =>
          `${contactDisplayName(contact)} ${contactAddress(contact)}`
            .toLowerCase()
            .includes(query),
        )
      : list;
    return matches.slice(0, 50);
  }, [contacts, contactFilter]);

  const selected = contacts?.find((contact) => contact.id === customerId);

  const pickContact = (id: string) => {
    setCustomerId(id);
    setPickerOpen(false);
    setContactFilter("");
    setProperties([]);
    setExistingHouseId(null);
    setError(null);
    setValues((current) => ({ ...current, placeId: "" }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!customerId) {
      setError("Pick the contact this house belongs to.");
      return;
    }
    const invalid = houseAgreementError(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    setExistingHouseId(null);
    try {
      const res = await fetch("/api/crm/maintenance/houses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerId,
          ...houseAgreementPayload(values, properties),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && typeof data.houseId === "string")
        setExistingHouseId(data.houseId);
      if (!res.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not add the house",
        );
      // Open the house right away so plants can be added next.
      router.replace(`/${locale}/crm/maintenance/houses/${data.id}?added=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the house");
      setSaving(false);
    }
  };

  return (
    <div className="w-full md:max-w-2xl md:mx-auto pb-24">
      <div className="py-2 md:mb-4 flex items-center justify-between gap-4">
        <Link
          href={backHref}
          className="flex items-center gap-2 text-gray-700 hover:text-black font-medium"
        >
          <ArrowLeft className="w-5 h-5 shrink-0" /> Back
        </Link>
        <span className="text-lg font-semibold text-gray-900">Add house</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
            {existingHouseId ? (
              <>
                {" "}
                <Link
                  href={`/${locale}/crm/maintenance/houses/${existingHouseId}`}
                  className="font-semibold underline"
                >
                  Open that house
                </Link>
              </>
            ) : null}
          </div>
        ) : null}

        <section className="space-y-3 rounded-lg border-2 border-black p-4">
          <h2 className="text-base font-semibold text-gray-900">Contact</h2>
          {selected ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-black px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {contactDisplayName(selected)}
                </div>
                <div className="truncate text-xs text-gray-600">
                  {contactAddress(selected) || "No address on file"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => pickContact("")}
                disabled={saving}
                className="inline-flex shrink-0 items-center gap-1 text-sm underline"
              >
                <X className="h-4 w-4" /> Change
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <TypingSearchInput
                  className="relative w-full"
                  value={contactFilter}
                  onChange={(value) => {
                    setContactFilter(value);
                    setPickerOpen(true);
                  }}
                  onFocus={() => setPickerOpen(true)}
                  onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
                  placeholder={
                    contacts === null
                      ? "Loading contacts…"
                      : "Search contacts by name or address…"
                  }
                  clearLabel="Clear contact search"
                  disabled={saving || contacts === null}
                />
                {pickerOpen && contacts !== null ? (
                  <ul className="absolute left-0 right-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border-2 border-black bg-white shadow-lg">
                    {visibleContacts.map((contact) => (
                      <li key={contact.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickContact(contact.id)}
                          className="block w-full px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <div className="text-sm font-medium">
                            {contactDisplayName(contact)}
                          </div>
                          {contactAddress(contact) ? (
                            <div className="text-xs text-gray-600">
                              {contactAddress(contact)}
                            </div>
                          ) : null}
                        </button>
                      </li>
                    ))}
                    {visibleContacts.length === 0 ? (
                      <li className="px-3 py-2 text-sm text-gray-600">
                        No contact matches. Use Add contact.
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setAddContactOpen(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Add contact
                </Button>
              </div>
            </div>
          )}
        </section>

        {customerId ? (
          <HouseAgreementForm
            key={customerId}
            customerId={customerId}
            contactAddress={
              properties.length === 0
                ? contactAddress(selected) || "No address on file"
                : undefined
            }
            values={values}
            onChange={setValues}
            onPropertiesLoaded={setProperties}
            disabled={saving}
          />
        ) : null}

        <p className="text-xs text-gray-500">
          After saving you can add the plants at this house.
        </p>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => router.push(backHref)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={saving || !customerId}
          >
            {saving ? "Adding…" : "Add house"}
          </Button>
        </div>
      </form>

      {addContactOpen ? (
        <Modal
          isOpen
          onClose={() => setAddContactOpen(false)}
          title="Add contact"
          showHeader
          maxWidth="lg"
          preventCloseOnOverlayClick
        >
          <CustomerForm
            mode="add"
            initial={emptyForm}
            lockedRoleSlug="customer"
            onCancel={() => setAddContactOpen(false)}
            onSuccess={async (created) => {
              setAddContactOpen(false);
              setContacts(await loadContacts());
              if (created) pickContact(created.id);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
