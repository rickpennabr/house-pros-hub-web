'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { getStandardSlotsForDay } from '@/lib/constants/bookingSlots';

export type TaskType = 'estimate_appointment' | 'business_meeting' | 'follow_up' | 'other';

interface CRMCustomer {
  id: string;
  first_name: string;
  last_name: string;
  display_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  estimate_appointment: 'Estimate Appointment',
  business_meeting: 'Business Meeting',
  follow_up: 'Follow up appointment',
  other: 'Other',
};

function formatSlotLabel(slotStart: Date, slotEnd: Date): string {
  return `${slotStart.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })} – ${slotEnd.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

function customerDisplayName(c: CRMCustomer): string {
  if (c.display_name?.trim()) return c.display_name.trim();
  return [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Customer';
}

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialCustomerId?: string | null;
  initialMeetingWith?: string;
}

export default function AddTaskModal({
  isOpen,
  onClose,
  onSuccess,
  initialCustomerId = null,
  initialMeetingWith = '',
}: AddTaskModalProps) {
  const [step, setStep] = useState(1);
  const [taskType, setTaskType] = useState<TaskType | null>(null);
  const [otherLabel, setOtherLabel] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [meetingWith, setMeetingWith] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [note, setNote] = useState('');
  const [customers, setCustomers] = useState<CRMCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [addCustomerSubmitting, setAddCustomerSubmitting] = useState(false);
  const [addCustomerError, setAddCustomerError] = useState<string | null>(null);
  const [addCustomerForm, setAddCustomerForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsCustomerStep = taskType === 'estimate_appointment' || taskType === 'follow_up';
  const needsMeetingWith = taskType === 'business_meeting' || taskType === 'other' || (needsCustomerStep && !customerId);

  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const res = await fetch('/api/crm/customers?pageSize=500', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setCustomers(data.customers ?? []);
      else setCustomers([]);
    } catch {
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && needsCustomerStep && step >= 2) fetchCustomers();
  }, [isOpen, needsCustomerStep, step, fetchCustomers]);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setTaskType(null);
      setOtherLabel('');
      setCustomerId(initialCustomerId);
      setMeetingWith(initialMeetingWith);
      setSelectedDate(null);
      setSelectedSlot(null);
      setNote('');
      setShowAddCustomer(false);
      setError(null);
    }
  }, [initialCustomerId, initialMeetingWith, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setCustomerId(initialCustomerId);
    setMeetingWith(initialMeetingWith);
  }, [initialCustomerId, initialMeetingWith, isOpen]);

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCustomerError(null);
    const firstName = addCustomerForm.firstName.trim();
    const lastName = addCustomerForm.lastName.trim();
    if (!firstName || !lastName) {
      setAddCustomerError('First and last name are required.');
      return;
    }
    setAddCustomerSubmitting(true);
    try {
      const res = await fetch('/api/crm/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: addCustomerForm.email.trim() || undefined,
          phone: addCustomerForm.phone.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add customer');
      await fetchCustomers();
      setShowAddCustomer(false);
      setAddCustomerForm({ firstName: '', lastName: '', email: '', phone: '' });
    } catch (err) {
      setAddCustomerError(err instanceof Error ? err.message : 'Failed to add customer');
    } finally {
      setAddCustomerSubmitting(false);
    }
  };

  const handleCreateTask = async () => {
    if (!taskType || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        task_type: taskType,
        startAt: selectedSlot.start.toISOString(),
        endAt: selectedSlot.end.toISOString(),
        note: note.trim() || undefined,
      };
      if (taskType === 'other' && otherLabel.trim()) body.other_label = otherLabel.trim();
      if (customerId) body.customer_id = customerId;
      if (meetingWith.trim()) body.meeting_with = meetingWith.trim();

      const res = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create task');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const year = selectedDate?.getFullYear() ?? new Date().getFullYear();
  const month = selectedDate?.getMonth() ?? new Date().getMonth();
  const dayStart = selectedDate ? new Date(year, month, selectedDate.getDate()) : null;
  const slots = dayStart ? getStandardSlotsForDay(dayStart) : [];
  const today = new Date();
  const isPastSlot = (s: { start: Date; end: Date }) => s.end <= today;

  if (!isOpen) return null;

  const title =
    step === 1
      ? 'Add Task'
      : step === 2 && (needsCustomerStep || needsMeetingWith)
        ? needsCustomerStep
          ? 'Select customer or who it’s with'
          : 'Who are you meeting?'
        : 'Pick date & time';

  return (
    <Modal isOpen onClose={onClose} title={title} showHeader showCloseButton maxWidth="md" preventCloseOnOverlayClick={submitting || addCustomerSubmitting}>
      <div className="p-2 md:px-6 md:py-5">
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

        {showAddCustomer ? (
          <div>
            <p className="text-sm text-gray-600 mb-4">Add a new customer to your CRM. They will appear in the list.</p>
            <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
              {addCustomerError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{addCustomerError}</div>}
              <FormField label="First name">
                <Input value={addCustomerForm.firstName} onChange={(e) => setAddCustomerForm((p) => ({ ...p, firstName: e.target.value }))} required />
              </FormField>
              <FormField label="Last name">
                <Input value={addCustomerForm.lastName} onChange={(e) => setAddCustomerForm((p) => ({ ...p, lastName: e.target.value }))} required />
              </FormField>
              <FormField label="Email">
                <Input type="email" value={addCustomerForm.email} onChange={(e) => setAddCustomerForm((p) => ({ ...p, email: e.target.value }))} />
              </FormField>
              <FormField label="Phone">
                <Input type="tel" value={addCustomerForm.phone} onChange={(e) => setAddCustomerForm((p) => ({ ...p, phone: e.target.value }))} />
              </FormField>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddCustomer(false)} disabled={addCustomerSubmitting}>
                  Back
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={addCustomerSubmitting}>
                  {addCustomerSubmitting ? 'Adding…' : 'Add Customer'}
                </Button>
              </div>
            </form>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Pick type of task</p>
            <div className="grid gap-2">
              {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setTaskType(type);
                    if (type !== 'other') setOtherLabel('');
                    setStep(2);
                  }}
                  className={`flex items-center justify-between w-full p-3 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                    taskType === type ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium text-gray-900">{TASK_TYPE_LABELS[type]}</span>
                </button>
              ))}
            </div>
          </div>
        ) : step === 2 && (needsCustomerStep || needsMeetingWith) ? (
          <div className="space-y-4">
            {needsCustomerStep && (
              <>
                <p className="text-sm text-gray-600">Select a customer or enter who the appointment is with.</p>
                {customersLoading ? (
                  <p className="text-sm text-gray-500">Loading customers…</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {customers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomerId(c.id);
                          setMeetingWith('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg border cursor-pointer ${
                          customerId === c.id ? 'border-black bg-gray-100' : 'border-transparent hover:bg-gray-50'
                        }`}
                      >
                        {customerDisplayName(c)}
                        {c.company_name && <span className="text-gray-500 text-sm ml-1">({c.company_name})</span>}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-600">Customer is not in the system?</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddCustomer(true)}>
                  Add Customer
                </Button>
                <p className="text-sm text-gray-500 mt-2">Or enter who the appointment is with below:</p>
              </>
            )}
            {taskType === 'other' && (
              <FormField label="Specify type (optional)">
                <Input value={otherLabel} onChange={(e) => setOtherLabel(e.target.value)} placeholder="e.g. Site visit" />
              </FormField>
            )}
            {(needsMeetingWith || (!needsCustomerStep && (taskType === 'business_meeting' || taskType === 'other'))) && (
              <FormField label={needsCustomerStep && !customerId ? "Who is this appointment with?" : "Who are you meeting?"}>
                <Input
                  value={meetingWith}
                  onChange={(e) => setMeetingWith(e.target.value)}
                  placeholder="Name or company"
                />
              </FormField>
            )}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setStep(1)} className="inline-flex items-center gap-1">
                <ChevronLeft className="w-4 h-4 shrink-0" /> Back
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setStep(3)}
                disabled={
                  (needsCustomerStep && !customerId && !meetingWith.trim()) ||
                  (taskType === 'business_meeting' && !meetingWith.trim())
                }
              >
                Next
              </Button>
            </div>
          </div>
        ) : step === 3 ? (
          <div className="space-y-4">
            {!selectedDate ? (
              <>
                <p className="text-sm text-gray-600">Pick a date</p>
                <Input
                  type="date"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) setSelectedDate(new Date(v + 'T12:00:00'));
                  }}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setSelectedDate(null)} className="text-sm text-gray-600 hover:text-black cursor-pointer inline-flex items-center gap-1">
                    <ChevronLeft className="w-4 h-4 shrink-0" /> Change date
                  </button>
                  <span className="text-sm font-medium text-gray-900">
                    {selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <p className="text-sm text-gray-600">Pick a time slot</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {slots.map((slot) => {
                    const past = isPastSlot(slot);
                    const selected =
                      selectedSlot &&
                      selectedSlot.start.getTime() === slot.start.getTime() &&
                      selectedSlot.end.getTime() === slot.end.getTime();
                    return (
                      <button
                        key={slot.start.toISOString()}
                        type="button"
                        disabled={past}
                        onClick={() => !past && setSelectedSlot(slot)}
                        className={`py-2.5 px-3 rounded-lg border-2 text-xs sm:text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                          selected ? 'border-black bg-gray-900 text-white' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {formatSlotLabel(slot.start, slot.end)}
                      </button>
                    );
                  })}
                </div>
                <FormField label="Note (optional)">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
                </FormField>
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setStep(2)} className="inline-flex items-center gap-1">
                    <ChevronLeft className="w-4 h-4 shrink-0" /> Back
                  </Button>
                  <Button type="button" variant="primary" size="sm" onClick={handleCreateTask} disabled={!selectedSlot || submitting}>
                    {submitting ? 'Creating…' : 'Create Task'}
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
