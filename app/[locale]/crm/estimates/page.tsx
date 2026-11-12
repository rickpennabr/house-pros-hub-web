'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Plus, Pencil, Trash2, MoreVertical, ArrowLeft, AlertTriangle, FileCheck, FolderPlus, Send, Loader2, Copy, Filter, LayoutGrid, FileText, Ban } from 'lucide-react';
import { CRMSearchField } from '@/components/crm/CRMSearchField';
import { MobileGridActionsModal } from '@/components/crm/MobileGridActionsModal';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import ViewToggle, { type ViewType } from '@/components/pageslayout/ViewToggle';
import { AddressPinsMap } from '@/components/maps/AddressPinsMap';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useCRMChrome } from '@/components/crm/CRMChromeContext';
import Pagination from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { EstimateDocumentForm } from '@/components/estimates/EstimateDocumentForm';
import { ProgressInvoiceDialog } from '@/components/invoices/ProgressInvoiceDialog';
import { CustomerEstimatePreview, type CustomerEstimatePreviewData } from '@/components/estimates/CustomerEstimatePreview';
import { AddProductServicePanel, type ProCrmItem } from '@/components/invoices/AddProductServicePanel';
import { DEFAULT_UNIT } from '@/lib/constants/unitOptions';
import { DOCUMENT_FORM_LAYOUT } from '@/lib/constants/documentFormLayout';
import { contactDisplayName, listedCustomerName } from '@/lib/crm/contact-name';
import { emptyEstimateStatusSummary, type EstimateStatusSummary } from '@/lib/crm/estimate-books';
import { EstimateStatusCards } from '@/components/crm/EstimateStatusCards';
import {
  duplicateEstimateDraftFromGetResponse,
  lineItemsForEstimateForm,
  type CrmEstimateLineItemForm,
} from '@/lib/utils/crmEstimateFormLineItems';

const PAGE_SIZE = 25;
type SortKey = 'created_at' | 'updated_at' | 'status' | 'due_date' | 'amount_cents';

const STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'declined'] as const;

function statusOptionLabel(value: string) {
  if (!value) return 'All';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const STATUS_FILTER_ICONS = {
  draft: FileText,
  sent: Send,
  accepted: FileCheck,
  declined: Ban,
} as const;

interface EstimateRow {
  id: string;
  customer_id: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerDisplayName?: string | null;
  customerPhone: string | null;
  customerAddress: string;
  amount_cents: number;
  status: string;
  due_date: string | null;
  created_at: string;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function getDefaultEstimateValidityDate(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const ESTIMATE_COLUMNS: AdminDataTableColumn<EstimateRow>[] = [
  { id: 'customer', label: 'Customer', width: 200 },
  { id: 'amount', label: 'Amount', sortKey: 'amount_cents', width: 130 },
  { id: 'status', label: 'Status', sortKey: 'status', width: 130 },
  { id: 'due', label: 'Valid until', sortKey: 'due_date', width: 150 },
  { id: 'actions', label: 'Actions', resizable: false },
];

function estimateCellText(row: EstimateRow, columnId: string): string {
  switch (columnId) {
    case 'customer':
      return listedCustomerName(row);
    case 'amount':
      return formatAmount(row.amount_cents);
    case 'status':
      return row.status;
    case 'due':
      return row.due_date ? formatDate(row.due_date) : '';
    default:
      return '';
  }
}

interface CustomerOption {
  id: string;
  first_name: string;
  last_name: string;
  display_name?: string | null;
  company_name?: string | null;
}

export type EstimateLineItem = CrmEstimateLineItemForm;

type ViewMode = 'table' | 'add' | 'edit';

export default function CRMEstimatesPage() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const crmChrome = useCRMChrome();
  const [estimates, setEstimates] = useState<EstimateRow[]>([]);
  const [statusSummary, setStatusSummary] = useState<EstimateStatusSummary>(emptyEstimateStatusSummary());
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [progressEstimateId, setProgressEstimateId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [reusableItems, setReusableItems] = useState<ProCrmItem[]>([]);
  const [addItemPanelOpen, setAddItemPanelOpen] = useState(false);
  const [addItemPanelRowIndex, setAddItemPanelRowIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [savedListView, setSavedListView] = useLocalStorage<string>('crmEstimatesView', 'list');
  const listView: ViewType = savedListView === 'map' ? 'map' : 'list';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{
    customerId: string;
    amountCents: number;
    status: string;
    dueDate: string;
    note: string;
    estimateNumber: string;
    customerEmail: string | null;
  } | null>(null);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formLineItems, setFormLineItems] = useState<EstimateLineItem[]>([
    { product_or_service: '', description: '', qty: 1, rate_cents: 0, amount_cents: 0 },
  ]);
  const [formStatus, setFormStatus] = useState('draft');
  const [formDueDate, setFormDueDate] = useState(getDefaultEstimateValidityDate());
  const [formNote, setFormNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const prefillsAppliedRef = useRef(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [loadingDuplicateId, setLoadingDuplicateId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchRowRef = useRef<HTMLDivElement | null>(null);
  const [sendDialogEstimateId, setSendDialogEstimateId] = useState<string | null>(null);
  const [sendDialogStep, setSendDialogStep] = useState<'preview' | 'compose' | 'confirm'>('preview');
  const [sendPreviewData, setSendPreviewData] = useState<CustomerEstimatePreviewData | null>(null);
  const [sendPreviewLoading, setSendPreviewLoading] = useState(false);
  const [sendPreviewError, setSendPreviewError] = useState<string | null>(null);
  const [sendDialogCustomerEmail, setSendDialogCustomerEmail] = useState<string | null>(null);
  const [sendMessage, setSendMessage] = useState('');
  const [sendingEstimateId, setSendingEstimateId] = useState<string | null>(null);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);

  const fetchEstimates = useCallback(async () => {
    const isFirst = !hasLoadedOnceRef.current;
    try {
      if (isFirst) setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sortBy, sortDir });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/crm/estimates?${params}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setEstimates(data.estimates ?? []);
      setTotal(data.total ?? 0);
      if (data.statusSummary) setStatusSummary(data.statusSummary);
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load estimates');
      if (isFirst) { setEstimates([]); setTotal(0); }
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortDir, search, statusFilter]);

  useEffect(() => { fetchEstimates(); }, [fetchEstimates]);

  useEffect(() => {
    if (!sendSuccessMessage) return;
    const id = window.setTimeout(() => setSendSuccessMessage(null), 5000);
    return () => window.clearTimeout(id);
  }, [sendSuccessMessage]);

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      setEditingId(id);
      setViewMode('edit');
      return;
    }
    if (searchParams.get('customerId') || searchParams.get('new') === '1') {
      setViewMode('add');
    }
  }, [searchParams]);

  useEffect(() => {
    if (viewMode === 'add' || viewMode === 'edit') {
      Promise.all([
        fetch('/api/crm/customers?pageSize=500&billable=1', { credentials: 'include' }).then((r) => r.json()),
        fetch('/api/crm/items', { credentials: 'include' }).then((r) => r.json()),
      ])
        .then(([customersData, itemsData]) => {
          setCustomers(customersData.customers ?? []);
          setReusableItems(itemsData.items ?? []);
        })
        .catch(() => {
          setCustomers([]);
          setReusableItems([]);
        });
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'add') return;
    if (prefillsAppliedRef.current) return;
    if (customers.length === 0) return;
    const requestedCustomerId = searchParams.get('customerId');
    if (requestedCustomerId && customers.some((customer) => customer.id === requestedCustomerId)) {
      setFormCustomerId(requestedCustomerId);
    }
    prefillsAppliedRef.current = true;
  }, [customers, searchParams, viewMode]);

  useEffect(() => {
    if (viewMode !== 'edit' || !editingId) return;
    let cancelled = false;
    setEditingData(null);
    fetch(`/api/crm/estimates/${editingId}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const items = lineItemsForEstimateForm(data.lineItems, data.amountCents ?? 0);
        setEditingData({
          customerId: data.customerId ?? '',
          amountCents: data.amountCents ?? 0,
          status: data.status ?? 'draft',
          dueDate: data.dueDate ? data.dueDate.slice(0, 10) : '',
          note: data.note ?? '',
          estimateNumber: data.displayId ?? data.display_id ?? '',
          customerEmail: typeof data.customerEmail === 'string' ? data.customerEmail : null,
        });
        setFormCustomerId(data.customerId ?? '');
        setFormLineItems(items);
        setFormStatus(data.status ?? 'draft');
        setFormDueDate(data.dueDate ? data.dueDate.slice(0, 10) : '');
        setFormNote(data.note ?? '');
      })
      .catch(() => {
        if (!cancelled) {
          setEditingData({ customerId: '', amountCents: 0, status: 'draft', dueDate: '', note: '', estimateNumber: '', customerEmail: null });
        }
      });
    return () => { cancelled = true; };
  }, [viewMode, editingId]);

  useEffect(() => {
    if (!crmChrome?.searchOpen) return;
    const close = (event: PointerEvent) => {
      if (searchRowRef.current?.contains(event.target as Node)) return;
      crmChrome.setSearchOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [crmChrome]);

  useEffect(() => {
    if (!openActionsId) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!actionsMenuRef.current?.contains(target) && !actionsButtonRef.current?.contains(target)) {
        setOpenActionsId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openActionsId]);

  const handleSort = (key: SortKey, dir: 'asc' | 'desc') => { setSortBy(key); setSortDir(dir); setPage(1); };
  const searchDebounceRef = useRef<number | null>(null);
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 200);
  };
  useEffect(() => () => {
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
  }, []);
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    setSearch(searchInput.trim());
    setPage(1);
  };

  const openProgressInvoice = (estimateId: string) => {
    setOpenActionsId(null);
    setMenuPosition(null);
    setError(null);
    setProgressEstimateId(estimateId);
  };

  const handleConvertToProject = async (estimateId: string) => {
    setConvertingId(estimateId);
    setOpenActionsId(null);
    setMenuPosition(null);
    setError(null);
    try {
      const res = await fetch('/api/crm/projects/convert-from-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ estimateId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create project');
      router.push(`/${locale}/crm/projects`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert to project');
    } finally {
      setConvertingId(null);
    }
  };

  const handleDuplicateEstimate = async (estimateId: string) => {
    setOpenActionsId(null);
    setMenuPosition(null);
    setFormError(null);
    setError(null);
    setLoadingDuplicateId(estimateId);
    try {
      const res = await fetch(`/api/crm/estimates/${estimateId}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load estimate');
      const draft = duplicateEstimateDraftFromGetResponse({
        customerId: data.customerId,
        lineItems: data.lineItems,
        amountCents: data.amountCents,
        note: data.note,
      });
      setEditingId(null);
      setEditingData(null);
      setFormCustomerId(draft.customerId);
      setFormLineItems(draft.lineItems);
      setFormStatus('draft');
      setFormDueDate(getDefaultEstimateValidityDate());
      setFormNote(draft.note);
      setViewMode('add');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate estimate');
    } finally {
      setLoadingDuplicateId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/estimates/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setDeleteConfirm(null);
      fetchEstimates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete estimate');
    } finally {
      setDeleting(false);
    }
  };
  const handleBulkDeleteConfirm = async () => {
    if (!bulkDeleteIds?.length) return;
    setDeleting(true);
    setError(null);
    try {
      for (const id of bulkDeleteIds) {
        const res = await fetch(`/api/crm/estimates/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to delete');
      }
      setBulkDeleteIds(null);
      fetchEstimates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete estimates');
    } finally {
      setDeleting(false);
    }
  };

  const openSendDialog = (estimateId: string) => {
    setSendDialogEstimateId(estimateId);
    setSendMessage('');
    setSendDialogStep('preview');
    setSendPreviewData(null);
    setSendPreviewError(null);
    setSendDialogCustomerEmail(null);
    setSendPreviewLoading(true);
    fetch(`/api/crm/estimates/${estimateId}/customer-preview`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(typeof d.error === 'string' ? d.error : 'Failed to load preview');
        setSendPreviewData(d as CustomerEstimatePreviewData);
        const email =
          typeof d.customer?.email === 'string' && d.customer.email.trim() ? d.customer.email.trim() : null;
        setSendDialogCustomerEmail(email);
      })
      .catch((err) => {
        setSendPreviewData(null);
        setSendDialogCustomerEmail(null);
        setSendPreviewError(err instanceof Error ? err.message : 'Could not load preview.');
      })
      .finally(() => setSendPreviewLoading(false));
  };

  const handleSendEstimate = async () => {
    if (!sendDialogEstimateId) return;
    setSendingEstimateId(sendDialogEstimateId);
    setError(null);
    try {
      const res = await fetch(`/api/crm/estimates/${sendDialogEstimateId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: sendMessage.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const base = typeof data.error === 'string' ? data.error : 'Failed to send estimate';
        const extra = typeof data.details === 'string' ? ` ${data.details}` : '';
        throw new Error(`${base}${extra}`);
      }
      setSendDialogEstimateId(null);
      setSendMessage('');
      setSendDialogStep('preview');
      setSendPreviewData(null);
      setSendSuccessMessage(`Estimate sent to ${typeof data.sentTo === 'string' ? data.sentTo : 'your customer'}.`);
      fetchEstimates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send estimate');
    } finally {
      setSendingEstimateId(null);
    }
  };

  const applyItemToRow = (item: ProCrmItem, rowIndex: number) => {
    setFormLineItems((prev) => {
      const next = [...prev];
      if (rowIndex >= 0 && rowIndex < next.length) {
        next[rowIndex] = {
          ...next[rowIndex],
          product_or_service: item.name,
          description: item.description ?? next[rowIndex].description,
          unit: item.unit || DEFAULT_UNIT,
          rate_cents: item.price_cents,
          amount_cents: Math.round((next[rowIndex].qty || 1) * item.price_cents),
        };
      }
      return next;
    });
  };

  const handleAddItemSaved = (item: ProCrmItem, action: 'close' | 'saveAndNew') => {
    setReusableItems((prev) => {
      const idx = prev.findIndex((existingItem) => existingItem.id === item.id);
      if (idx === -1) return [...prev, item];
      const next = [...prev];
      next[idx] = item;
      return next;
    });
    if (addItemPanelRowIndex !== null) {
      applyItemToRow(item, addItemPanelRowIndex);
    }
    if (action === 'close') {
      setAddItemPanelRowIndex(null);
      setAddItemPanelOpen(false);
      return;
    }
    // For save-and-new, keep modal open so users can add another item quickly.
    setAddItemPanelRowIndex(null);
  };

  const lineItemsPayload = formLineItems
    .filter((line) => line.description || line.product_or_service || line.amount_cents > 0)
    .map((line) => ({
      product_or_service: line.product_or_service || null,
      description: line.description || null,
      unit: line.unit || DEFAULT_UNIT,
      qty: line.qty,
      rate_cents: line.rate_cents,
      amount_cents: line.amount_cents,
    }));
  const totalAmountCents =
    lineItemsPayload.length > 0
      ? lineItemsPayload.reduce((sum, l) => sum + l.amount_cents, 0)
      : 0;

  const syncEstimateLinesToReusableItems = async (lines: typeof lineItemsPayload) => {
    const normalizedIncoming = lines
      .filter((line) => line.product_or_service && line.product_or_service.trim())
      .map((line) => ({
        name: (line.product_or_service ?? '').trim(),
        description: (line.description ?? '').trim(),
        unit: (line.unit ?? DEFAULT_UNIT).trim() || DEFAULT_UNIT,
        price_cents: Math.max(0, Math.round(line.rate_cents ?? 0)),
      }));
    if (normalizedIncoming.length === 0) return;

    const existingRes = await fetch('/api/crm/items', { credentials: 'include' });
    const existingData = await existingRes.json().catch(() => ({}));
    const existingItems: ProCrmItem[] = existingData.items ?? [];

    const existingKeys = new Set(
      existingItems.map((item) =>
        JSON.stringify({
          name: (item.name ?? '').trim().toLowerCase(),
          description: (item.description ?? '').trim().toLowerCase(),
          unit: (item.unit ?? DEFAULT_UNIT).trim().toLowerCase(),
          price_cents: Math.max(0, Math.round(item.price_cents ?? 0)),
        })
      )
    );

    for (const line of normalizedIncoming) {
      const key = JSON.stringify({
        name: line.name.toLowerCase(),
        description: line.description.toLowerCase(),
        unit: line.unit.toLowerCase(),
        price_cents: line.price_cents,
      });
      if (existingKeys.has(key)) continue;
      const createRes = await fetch('/api/crm/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: line.name,
          item_type: 'service',
          description: line.description || undefined,
          price_cents: line.price_cents,
          unit: line.unit,
        }),
      });
      if (createRes.ok) existingKeys.add(key);
    }
  };

  const getCreateEstimateValidationError = (): string | null => {
    if (!formCustomerId) return 'Select a customer';
    const hasInvalidLine = formLineItems.some((line) => {
      const touched =
        Boolean(line.description?.trim()) ||
        Boolean(line.product_or_service?.trim()) ||
        line.qty > 0 ||
        line.rate_cents > 0 ||
        line.amount_cents > 0;
      return touched && !line.product_or_service?.trim();
    });
    if (hasInvalidLine) {
      return 'Choose a product or service from reusable items before saving.';
    }
    const seen = new Set<string>();
    for (const line of formLineItems) {
      const key = JSON.stringify({
        product_or_service: (line.product_or_service ?? '').trim().toLowerCase(),
        description: (line.description ?? '').trim().toLowerCase(),
        unit: (line.unit ?? '').trim().toLowerCase(),
        qty: line.qty,
        rate_cents: line.rate_cents,
        amount_cents: line.amount_cents,
      });
      if (seen.has(key)) return 'You have a duplicated item on your estimate. Modify one before creating.';
      seen.add(key);
    }
    return null;
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const validationError = getCreateEstimateValidationError();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const amountCents = totalAmountCents;
    const lineItemsToSend = lineItemsPayload.length > 0 ? lineItemsPayload : null;
    setSaving(true);
    try {
      const res = await fetch('/api/crm/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: formCustomerId,
          amountCents,
          lineItems: lineItemsToSend,
          status: formStatus,
          dueDate: formDueDate || null,
          note: formNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create estimate');
      await syncEstimateLinesToReusableItems(lineItemsToSend ?? []);
      setViewMode('table');
      setFormCustomerId('');
      setFormLineItems([{ product_or_service: '', description: '', unit: DEFAULT_UNIT, qty: 1, rate_cents: 0, amount_cents: 0 }]);
      setFormStatus('draft');
      setFormDueDate(getDefaultEstimateValidityDate());
      setFormNote('');
      fetchEstimates();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReviewAndSendCreate = async () => {
    setFormError(null);
    const validationError = getCreateEstimateValidationError();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    const amountCents = totalAmountCents;
    const lineItemsToSend = lineItemsPayload.length > 0 ? lineItemsPayload : null;
    setSaving(true);
    try {
      const res = await fetch('/api/crm/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: formCustomerId,
          amountCents,
          lineItems: lineItemsToSend,
          status: formStatus,
          dueDate: formDueDate || null,
          note: formNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create estimate');
      const newId = typeof data.id === 'string' ? data.id : null;
      if (!newId) throw new Error('Invalid response from server');
      await syncEstimateLinesToReusableItems(lineItemsToSend ?? []);
      setEditingId(newId);
      setViewMode('edit');
      openSendDialog(newId);
      fetchEstimates();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    if (!formCustomerId) {
      setFormError('Select a customer');
      return;
    }
    const hasInvalidLine = formLineItems.some((line) => {
      const touched =
        Boolean(line.description?.trim()) ||
        Boolean(line.product_or_service?.trim()) ||
        line.qty > 0 ||
        line.rate_cents > 0 ||
        line.amount_cents > 0;
      return touched && !line.product_or_service?.trim();
    });
    if (hasInvalidLine) {
      setFormError('Choose a product or service from reusable items before saving.');
      return;
    }
    const hasExactDuplicateLines = (() => {
      const seen = new Set<string>();
      for (const line of formLineItems) {
        const key = JSON.stringify({
          product_or_service: (line.product_or_service ?? '').trim().toLowerCase(),
          description: (line.description ?? '').trim().toLowerCase(),
          unit: (line.unit ?? '').trim().toLowerCase(),
          qty: line.qty,
          rate_cents: line.rate_cents,
          amount_cents: line.amount_cents,
        });
        if (seen.has(key)) return true;
        seen.add(key);
      }
      return false;
    })();
    if (hasExactDuplicateLines) {
      setFormError('You have a duplicated item on your estimate. Modify one before creating.');
      return;
    }
    setFormError(null);
    const amountCents = totalAmountCents;
    const lineItemsToSend = lineItemsPayload.length > 0 ? lineItemsPayload : null;
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/estimates/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: formCustomerId || undefined,
          amountCents,
          lineItems: lineItemsToSend,
          status: formStatus,
          dueDate: formDueDate || null,
          note: formNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update estimate');
      await syncEstimateLinesToReusableItems(lineItemsToSend ?? []);
      setViewMode('table');
      setEditingId(null);
      setEditingData(null);
      fetchEstimates();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const applyStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
    setFiltersOpen(false);
  };
  const statusFilterButton = !crmChrome?.searchOpen ? (
    <button
      type="button"
      onClick={() => setFiltersOpen(true)}
      className="relative h-11 w-11 shrink-0 rounded-lg border-2 border-black bg-black flex items-center justify-center cursor-pointer hover:bg-gray-800 md:hidden"
      aria-label="Filter"
    >
      <Filter className="w-5 h-5 text-white" />
      {statusFilter ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" /> : null}
    </button>
  ) : null;

  return (
    <div className="w-full">
      {sendSuccessMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-900 text-sm flex flex-wrap items-start justify-between gap-2">
          <span>{sendSuccessMessage}</span>
          <button
            type="button"
            className="shrink-0 text-green-800 underline font-medium cursor-pointer"
            onClick={() => setSendSuccessMessage(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex flex-wrap items-start justify-between gap-2">
          <span>{error}</span>
          <button type="button" className="shrink-0 underline font-medium cursor-pointer" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
      {viewMode === 'table' && (
        <>
          <div className="hidden md:flex flex-row items-center justify-between gap-4 pt-2 pb-2 md:pt-0 md:pb-0">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Estimates</h1>
              <p className="hidden md:block text-sm text-gray-500 mt-0.5">Create and track quotes for customers.</p>
            </div>
            <Button variant="primary" size="sm" className="hidden md:flex items-center gap-2 shrink-0" onClick={() => setViewMode('add')}>
              <Plus className="w-4 h-4" />
              New Estimate
            </Button>
          </div>
          <div className={crmChrome?.searchOpen ? 'max-md:hidden' : undefined}>
            <EstimateStatusCards
              summary={statusSummary}
              active={statusFilter}
              onSelect={applyStatusFilter}
            />
          </div>
          <div className="hidden md:flex flex-wrap gap-2 pb-3">
            {['', ...STATUS_OPTIONS].map((option) => {
              const selected = statusFilter === option;
              return (
                <button
                  key={option || 'all'}
                  type="button"
                  onClick={() => applyStatusFilter(option)}
                  className={`rounded-lg border-2 border-black px-3 py-1 text-sm font-medium cursor-pointer ${selected ? 'bg-black text-white' : 'bg-white text-black'}`}
                >
                  {statusOptionLabel(option)}
                </button>
              );
            })}
          </div>
          <div ref={searchRowRef} className="pt-2 pb-2 md:pt-0">
            <CRMSearchField
              className="min-w-0 md:max-w-md"
              value={searchInput}
              onChange={handleSearchInput}
              placeholder="Search customer..."
              onFocus={() => crmChrome?.setSearchOpen(true)}
              onSubmit={handleSearchSubmit}
              showClose={Boolean(crmChrome?.searchOpen)}
              onClose={() => {
                crmChrome?.setSearchOpen(false);
                (document.activeElement as HTMLElement | null)?.blur();
              }}
              endAction={statusFilterButton}
            />
          </div>
          <MobileGridActionsModal
            isOpen={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            title="Filter by status"
            items={[
              {
                id: 'all',
                label: 'All',
                icon: LayoutGrid,
                isActive: statusFilter === '',
                onClick: () => applyStatusFilter(''),
              },
              ...STATUS_OPTIONS.map((option) => ({
                id: option,
                label: statusOptionLabel(option),
                icon: STATUS_FILTER_ICONS[option],
                isActive: statusFilter === option,
                onClick: () => applyStatusFilter(option),
              })),
            ]}
          />
          {listView === 'map' ? (
            <AddressPinsMap
              pins={estimates.map((row) => ({
                id: row.id,
                title: listedCustomerName(row) || 'Estimate',
                detail: `${row.status} · ${formatAmount(row.amount_cents)}`,
                address: row.customerAddress || '',
              }))}
              onOpen={(id) => {
                setEditingId(id);
                setViewMode('edit');
              }}
            />
          ) : (
            <AdminDataTable
              columnOrderKey="crm-estimates"
              exportName="estimates"
              columns={ESTIMATE_COLUMNS}
              data={estimates}
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={(key, dir) => {
                if (key === 'amount_cents' || key === 'status' || key === 'due_date' || key === 'created_at' || key === 'updated_at') {
                  handleSort(key, dir);
                }
              }}
              searchInput={searchInput}
              onSearchInput={handleSearchInput}
              onSearchSubmit={handleSearchSubmit}
              searchPlaceholder="Search customer..."
              hideSearch
              isLoading={isLoading}
              isRefetching={false}
              hasLoadedOnce={hasLoadedOnce}
              error={null}
              getRowId={(row) => row.id}
              getCellText={estimateCellText}
              renderCell={(row, columnId) => estimateCellText(row, columnId) || '—'}
              onRowClick={(row) => { setEditingId(row.id); setViewMode('edit'); }}
              renderActions={(row) => (
                <button
                  ref={openActionsId === row.id ? actionsButtonRef : undefined}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (openActionsId === row.id) { setOpenActionsId(null); setMenuPosition(null); return; }
                    const rect = e.currentTarget.getBoundingClientRect();
                    actionsButtonRef.current = e.currentTarget;
                    setMenuPosition({ top: rect.bottom + 4, left: Math.min(rect.right - 120, window.innerWidth - 130) });
                    setOpenActionsId(row.id);
                  }}
                  className="p-1 rounded hover:bg-gray-200 text-gray-600 cursor-pointer"
                  aria-label="Actions"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              )}
              bulkActions={{
                onDelete: (ids) => setBulkDeleteIds(ids),
                onCopyAsJson: (rows) => { void navigator.clipboard.writeText(JSON.stringify(rows, null, 2)); },
                onEdit: (row) => { setEditingId(row.id); setViewMode('edit'); },
              }}
              emptyMessage="No estimates found."
              itemLabel="estimates"
              primaryColumnId="customer"
            />
          )}
          {listView === 'map' && !isLoading && total > 0 && (
            <div className="mt-4">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} itemsPerPage={PAGE_SIZE} itemLabel="estimates" />
            </div>
          )}
          {!isLoading && (
            <ViewToggle
              currentView={listView}
              onViewChange={setSavedListView}
              views={['list', 'map']}
              hideBackgroundToggle
              onAdd={() => setViewMode('add')}
              addLabel="New estimate"
            />
          )}
        </>
      )}

      {(viewMode === 'add' || viewMode === 'edit') && (
        <div className={DOCUMENT_FORM_LAYOUT.pageContainer}>
          <div className="py-2 md:mb-6 flex items-center gap-4">
            <button
              type="button"
              onClick={() => { setViewMode('table'); setEditingId(null); setEditingData(null); }}
              className="flex items-center gap-2 text-gray-700 hover:text-black font-medium cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5 shrink-0" />
              Back
            </button>
            <span className="flex-1 text-center text-lg font-semibold text-gray-900">
              {viewMode === 'add' ? 'New Estimate' : 'Edit Estimate'}
            </span>
            <div className="shrink-0 min-w-[7.5rem] flex justify-end">
              {viewMode === 'edit' && editingId ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => void handleDuplicateEstimate(editingId)}
                  disabled={loadingDuplicateId === editingId}
                >
                  {loadingDuplicateId === editingId ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                  ) : (
                    <Copy className="w-4 h-4 shrink-0" aria-hidden />
                  )}
                  Duplicate
                </Button>
              ) : null}
            </div>
          </div>
          {(viewMode === 'add' || editingData !== null) && (
            <EstimateDocumentForm
              mode={viewMode === 'add' ? 'create' : 'edit'}
              estimateNumber={viewMode === 'edit' ? (editingData?.estimateNumber ?? '') : ''}
              customers={customers}
              customerId={formCustomerId}
              onCustomerIdChange={setFormCustomerId}
              lineItems={formLineItems}
              onLineItemsChange={setFormLineItems}
              validUntilDate={formDueDate}
              onValidUntilDateChange={setFormDueDate}
              status={formStatus}
              onStatusChange={setFormStatus}
              note={formNote}
              onNoteChange={setFormNote}
              saving={saving}
              error={formError}
              onSubmit={viewMode === 'add' ? handleSubmitAdd : handleSubmitEdit}
              onCancel={() => { setViewMode('table'); setEditingId(null); setEditingData(null); }}
              submitLabel={viewMode === 'add' ? 'Create Estimate' : 'Save changes'}
              reusableItems={reusableItems}
              onReviewAndSend={
                viewMode === 'edit' && editingId
                  ? () => openSendDialog(editingId)
                  : viewMode === 'add'
                    ? handleReviewAndSendCreate
                    : undefined
              }
              reviewSending={Boolean(editingId && sendingEstimateId === editingId)}
              onOpenAddReusableItem={(rowIndex) => {
                setAddItemPanelRowIndex(typeof rowIndex === 'number' ? rowIndex : null);
                setAddItemPanelOpen(true);
              }}
            />
          )}
          {viewMode === 'edit' && editingData === null && <div className="p-12 text-center text-gray-500 text-sm">Loading…</div>}
        </div>
      )}

      {deleteConfirm && (
        <Modal isOpen onClose={() => !deleting && setDeleteConfirm(null)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={deleting}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete estimate?</h2>
            <p className="text-gray-600 mb-6">Are you sure? This cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(deleteConfirm.id)} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {bulkDeleteIds && bulkDeleteIds.length > 0 && (
        <Modal isOpen onClose={() => !deleting && setBulkDeleteIds(null)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={deleting}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete estimates?</h2>
            <p className="text-gray-600 mb-6">Delete {bulkDeleteIds.length} estimate{bulkDeleteIds.length === 1 ? '' : 's'}? This cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" size="sm" onClick={() => setBulkDeleteIds(null)} disabled={deleting}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => void handleBulkDeleteConfirm()} disabled={deleting}>{deleting ? 'Deleting…' : `Delete ${bulkDeleteIds.length}`}</Button>
            </div>
          </div>
        </Modal>
      )}

      {openActionsId && menuPosition && typeof document !== 'undefined' &&
        createPortal(
          (() => (
              <div ref={actionsMenuRef} className="fixed z-[100] min-w-[140px] py-1 bg-white border border-gray-200 rounded-md shadow-lg" style={{ top: menuPosition.top, left: menuPosition.left }}>
                <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { setEditingId(openActionsId); setViewMode('edit'); setOpenActionsId(null); setMenuPosition(null); }}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  onClick={() => {
                    if (openActionsId) void handleDuplicateEstimate(openActionsId);
                  }}
                  disabled={loadingDuplicateId === openActionsId}
                >
                  {loadingDuplicateId === openActionsId ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                  ) : (
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                  )}
                  Duplicate
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
                  onClick={() => {
                    openSendDialog(openActionsId);
                    setOpenActionsId(null);
                    setMenuPosition(null);
                  }}
                  disabled={sendingEstimateId === openActionsId}
                >
                  <Send className="w-3.5 h-3.5" /> Review & Send
                </button>
                <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => openProgressInvoice(openActionsId)}>
                  <FileCheck className="w-3.5 h-3.5" /> Create invoice
                </button>
                <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => handleConvertToProject(openActionsId)} disabled={convertingId === openActionsId}>
                  <FolderPlus className="w-3.5 h-3.5" /> Convert to project
                </button>
                <button type="button" className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { const r = estimates.find((e) => e.id === openActionsId); if (r) setDeleteConfirm({ id: r.id, label: listedCustomerName(r) || 'Estimate' }); setOpenActionsId(null); setMenuPosition(null); }}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
          ))(),
          document.body
        )}

      <ProgressInvoiceDialog
        estimateId={progressEstimateId}
        onClose={() => setProgressEstimateId(null)}
        onCreated={(invoiceId) => router.push(`/${locale}/crm/invoices/${invoiceId}`)}
      />

      {sendDialogEstimateId && (
        <Modal
          isOpen
          onClose={() => {
            if (sendingEstimateId) return;
            setSendDialogEstimateId(null);
            setSendDialogStep('preview');
            setSendPreviewData(null);
            setSendPreviewError(null);
          }}
          showHeader={false}
          showCloseButton
          maxWidth={sendDialogStep === 'preview' ? 'full' : 'sm'}
          overlayClassName={sendDialogStep === 'preview' ? 'md:!p-2 lg:!p-4' : ''}
          className={
            sendDialogStep === 'preview'
              ? '!max-w-[min(100vw-1rem,96rem)] w-full'
              : ''
          }
          preventCloseOnOverlayClick={Boolean(sendingEstimateId)}
          contentClassName={sendDialogStep === 'preview' ? 'p-4 md:p-6 overflow-y-auto max-h-[calc(90vh-2rem)]' : 'p-6'}
        >
          <div className="relative">
            {sendingEstimateId && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 rounded-lg min-h-[120px]">
                <Loader2 className="w-10 h-10 text-gray-900 animate-spin" aria-hidden />
                <p className="text-sm font-medium text-gray-900">Sending email…</p>
                <p className="text-xs text-gray-500 text-center px-4">Please keep this tab open.</p>
              </div>
            )}
            {sendDialogStep === 'preview' && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Review & Send</h2>
                <p className="text-sm text-gray-600 mb-4">
                  This matches what your customer will see (except they get an Approve button on the live link). When you are ready, continue to add an optional note and send the email.
                </p>
                {sendPreviewLoading && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-600">
                    <Loader2 className="w-10 h-10 animate-spin text-gray-900" aria-hidden />
                    <p className="text-sm">Loading customer preview…</p>
                  </div>
                )}
                {!sendPreviewLoading && sendPreviewError && (
                  <p className="text-sm text-red-600 mb-4">{sendPreviewError}</p>
                )}
                {!sendPreviewLoading && sendPreviewData && (
                  <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <CustomerEstimatePreview data={sendPreviewData} variant="preview" />
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSendDialogEstimateId(null);
                      setSendDialogStep('preview');
                      setSendPreviewData(null);
                      setSendPreviewError(null);
                    }}
                    disabled={Boolean(sendingEstimateId)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setSendDialogStep('compose')}
                    disabled={
                      Boolean(sendingEstimateId) || sendPreviewLoading || !sendPreviewData || Boolean(sendPreviewError)
                    }
                  >
                    Continue to email
                  </Button>
                </div>
              </>
            )}
            {sendDialogStep === 'compose' && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Email to customer</h2>
                <p className="text-sm text-gray-600 mb-4">Add an optional message, then confirm to send the secure link.</p>
                <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <span className="text-gray-500">To </span>
                  <span className="font-medium text-gray-900 break-all">{sendDialogCustomerEmail || '—'}</span>
                </div>
                {!sendDialogCustomerEmail && (
                  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
                    Add an email address on this customer before sending.
                  </p>
                )}
                <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
                <textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Add a short message to include in the email."
                  disabled={Boolean(sendingEstimateId)}
                />
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSendDialogStep('preview')}
                    disabled={Boolean(sendingEstimateId)}
                  >
                    Back to preview
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSendDialogEstimateId(null);
                      setSendDialogStep('preview');
                      setSendPreviewData(null);
                      setSendPreviewError(null);
                    }}
                    disabled={Boolean(sendingEstimateId)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setSendDialogStep('confirm')}
                    disabled={Boolean(sendingEstimateId) || !sendDialogCustomerEmail}
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}
            {sendDialogStep === 'confirm' && (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Send estimate</h2>
                <p className="text-sm text-gray-700 mb-4">
                  Send this estimate now to{' '}
                  <strong className="break-all">{sendDialogCustomerEmail}</strong>? The customer will receive an email with a link that matches the preview you saw.
                </p>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSendDialogStep('compose')}
                    disabled={Boolean(sendingEstimateId)}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSendEstimate}
                    disabled={Boolean(sendingEstimateId) || !sendDialogCustomerEmail}
                  >
                    Send email
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      <AddProductServicePanel
        isOpen={addItemPanelOpen}
        onClose={() => { setAddItemPanelOpen(false); setAddItemPanelRowIndex(null); }}
        onSaved={handleAddItemSaved}
        existingItems={reusableItems}
      />
    </div>
  );
}
