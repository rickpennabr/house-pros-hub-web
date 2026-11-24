'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Plus, Pencil, Trash2, MoreVertical, ArrowLeft, AlertTriangle, FileCheck, FolderPlus, Send, Loader2, Copy, Filter, LayoutGrid, FileText, Ban, Tablet } from 'lucide-react';
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
import {
  discountedTotalCents,
  discountFormText,
  discountFromForm,
  type DiscountKind,
  type DocumentDiscount,
} from '@/lib/crm/document-discount';
import { CustomerEstimatePreview, type CustomerEstimatePreviewData } from '@/components/estimates/CustomerEstimatePreview';
import { EstimateViewTabs, type EstimateView } from '@/components/estimates/EstimateViews';
import { ProjectFromEstimateDialog } from '@/components/crm/ProjectFromEstimateDialog';
import { BsGrid3X3Gap } from 'react-icons/bs';
import { AddProductServicePanel, type ProCrmItem } from '@/components/invoices/AddProductServicePanel';
import { DEFAULT_UNIT } from '@/lib/constants/unitOptions';
import { contactDisplayName, listedCustomerName } from '@/lib/crm/contact-name';
import { emptyEstimateStatusSummary, type EstimateStatusSummary } from '@/lib/crm/estimate-books';
import { EstimateStatusCards } from '@/components/crm/EstimateStatusCards';
import { EstimateChart } from '@/components/crm/EstimateChart';
import type { EstimateChart as EstimateChartData } from '@/lib/crm/estimate-chart';
import {
  duplicateEstimateDraftFromGetResponse,
  lineItemsForEstimateForm,
  type CrmEstimateLineItemForm,
} from '@/lib/utils/crmEstimateFormLineItems';
import type { AgreementKind, MaintenanceFrequency } from '@/lib/crm/estimate-agreement';
import {
  estimateDeposit,
  estimateFormError,
  estimateLinesPayload,
  estimateTotalCents,
  syncEstimateLinesToReusableItems as syncEstimateLinesToCatalog,
} from '@/lib/crm/estimate-form';
import { chatReturnWithDoc, safeChatReturnTo } from '@/lib/chat/crm-doc-share';
import { TitleCount } from '@/components/crm/TitleCount';

const PAGE_SIZE = 25;
type SortKey = 'created_at' | 'updated_at' | 'status' | 'due_date' | 'amount_cents';

const STATUS_OPTIONS = ['draft', 'sent', 'accepted', 'declined'] as const;

function statusOptionLabel(value: string) {
  if (!value) return 'All';
  if (value === 'accepted') return 'Approved';
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
  /** Opened from a chat: go back to it after saving, and the chat attaches the estimate. */
  const chatReturnTo = safeChatReturnTo(searchParams.get('returnTo'));
  const crmChrome = useCRMChrome();
  const [estimates, setEstimates] = useState<EstimateRow[]>([]);
  const [statusSummary, setStatusSummary] = useState<EstimateStatusSummary>(emptyEstimateStatusSummary());
  const [chart, setChart] = useState<EstimateChartData | null>(null);
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
  const [savedListView, setSavedListView] = useLocalStorage<string>('crmEstimatesView', 'table');
  const listView: ViewType = savedListView === 'map' || savedListView === 'chart' ? savedListView : 'table';
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
  /** The customer's house this estimate is for. Empty: the contact's default house. */
  const [formPlaceId, setFormPlaceId] = useState('');
  const [formLineItems, setFormLineItems] = useState<EstimateLineItem[]>([
    { product_or_service: '', description: '', qty: 1, rate_cents: 0, amount_cents: 0 },
  ]);
  const [formStatus, setFormStatus] = useState('draft');
  const [formDueDate, setFormDueDate] = useState(getDefaultEstimateValidityDate());
  const [formNote, setFormNote] = useState('');
  const [formDeposit, setFormDeposit] = useState('');
  const [formDiscountKind, setFormDiscountKind] = useState<DiscountKind>('percent');
  const [formDiscountValue, setFormDiscountValue] = useState('');
  const [convertingToInvoice, setConvertingToInvoice] = useState(false);
  const applyDiscount = (discount: DocumentDiscount | null | undefined) => {
    setFormDiscountKind(discount?.kind ?? 'percent');
    setFormDiscountValue(discountFormText(discount));
  };
  const [formJobArea, setFormJobArea] = useState('');
  const [formAgreementKind, setFormAgreementKind] = useState<AgreementKind>('project');
  const [formMaintenanceFrequency, setFormMaintenanceFrequency] = useState<MaintenanceFrequency | ''>('');
  const [presentLoadingId, setPresentLoadingId] = useState<string | null>(null);
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
      if (listView === 'chart') {
        params.set('chart', '1');
        params.set('timeZone', Intl.DateTimeFormat().resolvedOptions().timeZone);
      }
      const res = await fetch(`/api/crm/estimates?${params}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setEstimates(data.estimates ?? []);
      setTotal(data.total ?? 0);
      if (data.statusSummary) setStatusSummary(data.statusSummary);
      setChart(data.chart ?? null);
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load estimates');
      if (isFirst) { setEstimates([]); setTotal(0); }
    } finally {
      setIsLoading(false);
    }
  }, [page, sortBy, sortDir, search, statusFilter, listView]);

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
        setFormPlaceId(typeof data.placeId === 'string' ? data.placeId : '');
        setFormLineItems(items);
        setFormStatus(data.status ?? 'draft');
        setFormDueDate(data.dueDate ? data.dueDate.slice(0, 10) : '');
        setFormNote(data.note ?? '');
        setFormDeposit(data.depositCents ? (Number(data.depositCents) / 100).toFixed(2) : '');
        applyDiscount(data.discount);
        setFormJobArea(typeof data.jobArea === 'string' ? data.jobArea : '');
        setFormAgreementKind((data.agreementKind as AgreementKind) || 'project');
        setFormMaintenanceFrequency((data.maintenanceFrequency as MaintenanceFrequency) || '');
      })
      .catch(() => {
        if (!cancelled) {
          setEditingData({ customerId: '', amountCents: 0, status: 'draft', dueDate: '', note: '', estimateNumber: '', customerEmail: null });
          setFormDeposit('');
          applyDiscount(null);
          setFormJobArea('');
          setFormAgreementKind('project');
          setFormMaintenanceFrequency('');
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

  /** Opens the project dialog (name, dates, status, project manager, notes) for an approved estimate. */
  const handleConvertToProject = (estimateId: string) => {
    setOpenActionsId(null);
    setMenuPosition(null);
    setError(null);
    setProjectEstimateId(estimateId);
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
      setFormPlaceId(typeof data.placeId === 'string' ? data.placeId : '');
      setFormLineItems(draft.lineItems);
      setFormStatus('draft');
      setFormDueDate(getDefaultEstimateValidityDate());
      setFormNote(draft.note);
      setFormDeposit(data.depositCents ? (Number(data.depositCents) / 100).toFixed(2) : '');
      applyDiscount(data.discount);
      setFormJobArea(typeof data.jobArea === 'string' ? data.jobArea : '');
      setFormAgreementKind((data.agreementKind as AgreementKind) || 'project');
      setFormMaintenanceFrequency((data.maintenanceFrequency as MaintenanceFrequency) || '');
      setViewMode('add');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate estimate');
    } finally {
      setLoadingDuplicateId(null);
    }
  };

  const presentEstimateOnDevice = async (estimateId: string) => {
    setPresentLoadingId(estimateId);
    setFormError(null);
    setError(null);
    try {
      const res = await fetch(`/api/crm/estimates/${estimateId}/share-link`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.url !== 'string') {
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not open the agreement');
      }
      const presentUrl = `${data.url}${data.url.includes('?') ? '&' : '?'}present=1`;
      window.open(presentUrl, '_blank', 'noopener,noreferrer');
      fetchEstimates();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not open the agreement');
    } finally {
      setPresentLoadingId(null);
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

  /** The open estimate's view: the editor or what the customer sees (like the invoice tabs). */
  const [projectEstimateId, setProjectEstimateId] = useState<string | null>(null);
  const [editorView, setEditorView] = useState<EstimateView>('edit');
  const [editorActionsOpen, setEditorActionsOpen] = useState(false);
  const [editorPreview, setEditorPreview] = useState<CustomerEstimatePreviewData | null>(null);
  const [editorPreviewLoading, setEditorPreviewLoading] = useState(false);
  const [editorPreviewError, setEditorPreviewError] = useState<string | null>(null);
  /** The estimate the customer view was opened for; any other estimate opens on the editor. */
  const [editorViewFor, setEditorViewFor] = useState<string | null>(null);

  const loadEditorPreview = (estimateId: string) => {
    setEditorViewFor(estimateId);
    setEditorPreviewLoading(true);
    setEditorPreviewError(null);
    fetch(`/api/crm/estimates/${estimateId}/customer-preview`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(typeof d.error === 'string' ? d.error : 'Failed to load preview');
        setEditorPreview(d as CustomerEstimatePreviewData);
      })
      .catch((err) => {
        setEditorPreview(null);
        setEditorPreviewError(err instanceof Error ? err.message : 'Could not load the customer view.');
      })
      .finally(() => setEditorPreviewLoading(false));
  };

  const closeEstimateEditor = () => {
    setViewMode('table');
    setEditingId(null);
    setEditingData(null);
    setEditorView('edit');
    setEditorPreview(null);
  };

  const activeEditorView: EstimateView = editorView === 'customer' && editorViewFor === editingId ? 'customer' : 'edit';

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

  // Same rules as the chat's estimate window (lib/crm/estimate-form).
  const lineItemsPayload = estimateLinesPayload(formLineItems);
  const formDiscount = discountFromForm(formDiscountKind, formDiscountValue);
  // The total after the discount: the deposit is checked against it.
  const totalAmountCents = discountedTotalCents(estimateTotalCents(formLineItems), formDiscount);
  const syncEstimateLinesToReusableItems = syncEstimateLinesToCatalog;
  const depositPayload = () => estimateDeposit(formDeposit, totalAmountCents);
  const getCreateEstimateValidationError = (): string | null =>
    depositPayload().error ??
    estimateFormError({
      customerId: formCustomerId,
      lines: formLineItems,
      deposit: formDeposit,
      agreementKind: formAgreementKind,
      maintenanceFrequency: formMaintenanceFrequency,
    });

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
          depositCents: depositPayload().cents,
          discount: formDiscount,
          jobArea: formJobArea.trim() || null,
          placeId: formPlaceId || null,
          agreementKind: formAgreementKind,
          maintenanceFrequency: formAgreementKind === 'maintenance' ? formMaintenanceFrequency || null : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create estimate');
      await syncEstimateLinesToReusableItems(lineItemsToSend ?? []);
      if (chatReturnTo && typeof data.id === 'string') {
        router.push(chatReturnWithDoc(chatReturnTo, 'estimate', data.id));
        return;
      }
      setViewMode('table');
      setFormCustomerId('');
      setFormPlaceId('');
      setFormLineItems([{ product_or_service: '', description: '', unit: DEFAULT_UNIT, qty: 1, rate_cents: 0, amount_cents: 0 }]);
      setFormStatus('draft');
      setFormDueDate(getDefaultEstimateValidityDate());
      setFormNote('');
      setFormDeposit('');
      applyDiscount(null);
      setFormJobArea('');
      setFormAgreementKind('project');
      setFormMaintenanceFrequency('');
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
          depositCents: depositPayload().cents,
          discount: formDiscount,
          jobArea: formJobArea.trim() || null,
          placeId: formPlaceId || null,
          agreementKind: formAgreementKind,
          maintenanceFrequency: formAgreementKind === 'maintenance' ? formMaintenanceFrequency || null : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to create estimate');
      const newId = typeof data.id === 'string' ? data.id : null;
      if (!newId) throw new Error('Invalid response from server');
      await syncEstimateLinesToReusableItems(lineItemsToSend ?? []);
      if (chatReturnTo) {
        // The chat sends it as an approval card, so skip the email send dialog.
        router.push(chatReturnWithDoc(chatReturnTo, 'estimate', newId));
        return;
      }
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

  /** Save the open estimate. statusOverride saves it with that status (Convert to invoice approves it). */
  const saveEdit = async (statusOverride?: string): Promise<boolean> => {
    if (!editingId) return false;
    if (!formCustomerId) {
      setFormError('Select a customer');
      return false;
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
      return false;
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
      return false;
    }
    const deposit = depositPayload();
    if (deposit.error) {
      setFormError(deposit.error);
      return false;
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
          status: statusOverride ?? formStatus,
          dueDate: formDueDate || null,
          note: formNote.trim() || null,
          depositCents: depositPayload().cents,
          discount: formDiscount,
          jobArea: formJobArea.trim() || null,
          placeId: formPlaceId || null,
          agreementKind: formAgreementKind,
          maintenanceFrequency: formAgreementKind === 'maintenance' ? formMaintenanceFrequency || null : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update estimate');
      if (typeof data.depositError === 'string' && data.depositError) setError(data.depositError);
      await syncEstimateLinesToReusableItems(lineItemsToSend ?? []);
      return true;
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await saveEdit())) return;
    setViewMode('table');
    setEditingId(null);
    setEditingData(null);
    fetchEstimates();
  };

  /**
   * QuickBooks-style Convert to invoice: save the estimate as approved (the customer agreed),
   * then open the invoice step for the full balance or a progress amount.
   */
  const handleConvertToInvoice = async () => {
    if (!editingId || convertingToInvoice) return;
    setConvertingToInvoice(true);
    try {
      const saved = await saveEdit(editingData?.status === 'declined' ? undefined : 'accepted');
      if (!saved) return;
      setFormStatus('accepted');
      setEditingData((current) => (current ? { ...current, status: 'accepted' } : current));
      fetchEstimates();
      setProgressEstimateId(editingId);
    } finally {
      setConvertingToInvoice(false);
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
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900 inline-flex items-center gap-2">
                Estimates
                <TitleCount count={total} />
              </h1>
              <p className="hidden md:block text-sm text-gray-500 mt-0.5">Create and track quotes for customers.</p>
            </div>
            <Button variant="primary" size="sm" className="hidden md:flex items-center gap-2 shrink-0" onClick={() => setViewMode('add')}>
              <Plus className="w-4 h-4" />
              New Estimate
            </Button>
          </div>
          <div className={`mt-2 ${crmChrome?.searchOpen ? 'max-md:hidden' : ''}`}>
            <EstimateStatusCards
              summary={statusSummary}
              active={statusFilter}
              onSelect={applyStatusFilter}
            />
          </div>
          <div ref={searchRowRef} className="pt-2 pb-2 md:flex md:items-center md:gap-3 md:pt-0 md:pb-2">
            <CRMSearchField
              className="w-full min-w-0 md:flex-1"
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
            <div className="hidden md:flex md:shrink-0 md:flex-wrap md:items-center md:gap-2">
              {['', ...STATUS_OPTIONS].map((option) => {
                const selected = statusFilter === option;
                return (
                  <button
                    key={option || 'all'}
                    type="button"
                    onClick={() => applyStatusFilter(option)}
                    className={`inline-flex h-11 shrink-0 items-center rounded-lg border-2 border-black px-3 text-sm font-medium cursor-pointer ${selected ? 'bg-black text-white' : 'bg-white text-black'}`}
                  >
                    {statusOptionLabel(option)}
                  </button>
                );
              })}
            </div>
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
          {listView === 'chart' ? (
            chart ? (
              <EstimateChart
                chart={chart}
                filtered={Boolean(search)}
                activeStatus={statusFilter}
                onSelectStatus={applyStatusFilter}
              />
            ) : (
              <div className="p-12 text-center text-gray-500 text-sm">
                {error ? 'Chart could not be loaded.' : 'Loading chart…'}
              </div>
            )
          ) : listView === 'map' ? (
            <AddressPinsMap
              pins={estimates.map((row) => ({
                id: row.id,
                title: listedCustomerName(row) || 'Estimate',
                detail: `${statusOptionLabel(row.status)} · ${formatAmount(row.amount_cents)}`,
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
              views={['table', 'map', 'chart']}
              hideBackgroundToggle
              onAdd={() => setViewMode('add')}
              addLabel="New estimate"
            />
          )}
        </>
      )}

      {(viewMode === 'add' || viewMode === 'edit') && (
        <div className="w-full">
          {/* Same top as the invoice page: back on the left, the estimate's actions on the right. */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-2 mb-2 md:mb-4 no-print">
            <button
              type="button"
              onClick={closeEstimateEditor}
              className="flex items-center gap-2 text-gray-700 hover:text-black font-medium cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5 shrink-0" />
              Back to Estimates
            </button>
            {viewMode === 'edit' && editingId ? (
              <div className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 overflow-x-auto px-2 pb-1 md:mx-0 md:w-auto md:overflow-visible md:px-0 md:pb-0 [&_button]:shrink-0 [&_button]:whitespace-nowrap [&_svg]:shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => openSendDialog(editingId)}
                  disabled={sendingEstimateId === editingId}
                >
                  <Send className="w-4 h-4" />
                  Review &amp; Send
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => void presentEstimateOnDevice(editingId)}
                  disabled={presentLoadingId === editingId}
                >
                  <Tablet className="w-4 h-4" />
                  {presentLoadingId === editingId ? 'Opening…' : 'Present on device'}
                </Button>
                {editingData && editingData.status !== 'declined' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => void handleConvertToInvoice()}
                    disabled={convertingToInvoice}
                    title={editingData.status === 'accepted' ? undefined : 'Saves this estimate as approved, then creates the invoice'}
                  >
                    <FileCheck className="w-4 h-4" />
                    {convertingToInvoice ? 'Converting…' : 'Convert to invoice'}
                  </Button>
                ) : null}
                {editingData?.status === 'accepted' ? (
                  <Button variant="secondary" size="sm" className="flex items-center gap-2" onClick={() => handleConvertToProject(editingId)}>
                    <FolderPlus className="w-4 h-4" />
                    Convert to project
                  </Button>
                ) : null}
                <Button
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
                {/* Nine-dot menu: pinned to the right end so it stays reachable while the row scrolls. */}
                <div className="sticky right-0 ml-auto shrink-0 md:hidden">
                  <button
                    type="button"
                    onClick={() => setEditorActionsOpen(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-black border-2 border-black text-white cursor-pointer hover:bg-gray-800 transition-all"
                    aria-label="Estimate actions menu"
                    title="Estimate actions menu"
                  >
                    <BsGrid3X3Gap className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              <span className="text-lg font-semibold text-gray-900">New estimate</span>
            )}
          </div>
          {viewMode === 'edit' && editingId ? (
            <MobileGridActionsModal
              isOpen={editorActionsOpen}
              onClose={() => setEditorActionsOpen(false)}
              title="Estimate actions"
              items={[
                { id: 'send', label: 'Review & Send', icon: Send, onClick: () => { setEditorActionsOpen(false); openSendDialog(editingId); } },
                { id: 'present', label: 'Present on device', icon: Tablet, onClick: () => { setEditorActionsOpen(false); void presentEstimateOnDevice(editingId); } },
                ...(editingData && editingData.status !== 'declined'
                  ? [{ id: 'convert', label: 'Convert to invoice', icon: FileCheck, onClick: () => { setEditorActionsOpen(false); void handleConvertToInvoice(); } }]
                  : []),
                ...(editingData?.status === 'accepted'
                  ? [{ id: 'project', label: 'Convert to project', icon: FolderPlus, onClick: () => { setEditorActionsOpen(false); handleConvertToProject(editingId); } }]
                  : []),
                { id: 'duplicate', label: 'Duplicate', icon: Copy, onClick: () => { setEditorActionsOpen(false); void handleDuplicateEstimate(editingId); } },
                { id: 'back', label: 'All estimates', icon: FileText, onClick: () => { setEditorActionsOpen(false); closeEstimateEditor(); } },
              ]}
            />
          ) : null}
          {viewMode === 'edit' && editingId ? (
            <EstimateViewTabs
              view={activeEditorView}
              onChange={(next) => {
                setEditorView(next);
                if (next === 'customer') loadEditorPreview(editingId);
              }}
            />
          ) : null}
          {viewMode === 'edit' && activeEditorView === 'customer' ? (
            <div className="mb-6">
              {editorPreviewLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-600">
                  <Loader2 className="w-10 h-10 animate-spin text-gray-900" aria-hidden />
                  <p className="text-sm">Loading customer view…</p>
                </div>
              ) : editorPreviewError ? (
                <p className="text-sm text-red-600">{editorPreviewError}</p>
              ) : editorPreview ? (
                <>
                  <p className="mb-2 text-sm text-gray-600">What your customer sees on the estimate link (saved version; save first to include new changes).</p>
                  <div className="border-2 border-black rounded-lg overflow-hidden bg-gray-50">
                    <CustomerEstimatePreview data={editorPreview} variant="preview" />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          {(viewMode === 'add' || editingData !== null) && activeEditorView === 'edit' && (
            <EstimateDocumentForm
              mode={viewMode === 'add' ? 'create' : 'edit'}
              estimateNumber={viewMode === 'edit' ? (editingData?.estimateNumber ?? '') : ''}
              customers={customers}
              customerId={formCustomerId}
              onCustomerIdChange={(value) => {
                setFormCustomerId(value);
                setFormPlaceId('');
              }}
              placeId={formPlaceId}
              onPlaceIdChange={setFormPlaceId}
              lineItems={formLineItems}
              onLineItemsChange={setFormLineItems}
              validUntilDate={formDueDate}
              onValidUntilDateChange={setFormDueDate}
              status={formStatus}
              savedStatus={viewMode === 'edit' ? editingData?.status ?? null : null}
              onStatusChange={setFormStatus}
              note={formNote}
              onNoteChange={setFormNote}
              deposit={formDeposit}
              onDepositChange={setFormDeposit}
              jobArea={formJobArea}
              onJobAreaChange={setFormJobArea}
              agreementKind={formAgreementKind}
              onAgreementKindChange={setFormAgreementKind}
              maintenanceFrequency={formMaintenanceFrequency}
              onMaintenanceFrequencyChange={setFormMaintenanceFrequency}
              saving={saving}
              error={formError}
              onSubmit={viewMode === 'add' ? handleSubmitAdd : handleSubmitEdit}
              onCancel={closeEstimateEditor}
              submitLabel={viewMode === 'add' ? 'Create Estimate' : 'Save changes'}
              reusableItems={reusableItems}
              onReviewAndSend={viewMode === 'add' ? handleReviewAndSendCreate : undefined}
              reviewSending={Boolean(editingId && sendingEstimateId === editingId)}
              onPresentOnDevice={undefined}
              presentLoading={Boolean(editingId && presentLoadingId === editingId)}
              discountKind={formDiscountKind}
              discountValue={formDiscountValue}
              onDiscountChange={(kind, value) => {
                setFormDiscountKind(kind);
                setFormDiscountValue(value);
              }}
              onConvertToInvoice={undefined}
              convertLoading={convertingToInvoice}
              onOpenAddReusableItem={(rowIndex) => {
                setAddItemPanelRowIndex(typeof rowIndex === 'number' ? rowIndex : null);
                setAddItemPanelOpen(true);
              }}
            />
          )}
          {viewMode === 'edit' && editingData === null && activeEditorView === 'edit' && <div className="p-12 text-center text-gray-500 text-sm">Loading…</div>}
        </div>
      )}

      {deleteConfirm && (
        <Modal isOpen onClose={() => !deleting && setDeleteConfirm(null)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={deleting}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-4">
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
            <div className="w-14 h-14 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-4">
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
                    void presentEstimateOnDevice(openActionsId);
                    setOpenActionsId(null);
                    setMenuPosition(null);
                  }}
                  disabled={presentLoadingId === openActionsId}
                >
                  <Tablet className="w-3.5 h-3.5" /> Present on device
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
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={estimates.find((row) => row.id === openActionsId)?.status !== 'accepted'}
                  title={estimates.find((row) => row.id === openActionsId)?.status === 'accepted' ? undefined : 'Approve the estimate before creating an invoice'}
                  onClick={() => openProgressInvoice(openActionsId)}
                >
                  <FileCheck className="w-3.5 h-3.5" /> Create invoice
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={estimates.find((row) => row.id === openActionsId)?.status !== 'accepted'}
                  title={estimates.find((row) => row.id === openActionsId)?.status === 'accepted' ? undefined : 'Approve the estimate before creating a project'}
                  onClick={() => handleConvertToProject(openActionsId)}
                >
                  <FolderPlus className="w-3.5 h-3.5" /> Convert to project
                </button>
                <button type="button" className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2 cursor-pointer" onClick={() => { const r = estimates.find((e) => e.id === openActionsId); if (r) setDeleteConfirm({ id: r.id, label: listedCustomerName(r) || 'Estimate' }); setOpenActionsId(null); setMenuPosition(null); }}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
          ))(),
          document.body
        )}

      <ProjectFromEstimateDialog
        estimateId={projectEstimateId}
        customerName={(() => {
          const row = estimates.find((item) => item.id === projectEstimateId);
          return row ? listedCustomerName(row) : null;
        })()}
        onClose={() => setProjectEstimateId(null)}
        onCreated={(projectId) => {
          setProjectEstimateId(null);
          router.push(`/${locale}/crm/projects/${projectId}`);
        }}
      />

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
