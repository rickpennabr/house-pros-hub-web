'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Check,
  Compass,
  Copy,
  Download,
  Eye,
  EyeOff,
  FolderInput,
  Image as ImageIcon,
  ImagePlus,
  MapPin,
  MessageSquare,
  Pencil,
  MoreHorizontal,
  Plus,
  Search,
  Share2,
  Tag,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { JobPhotoMap } from '@/components/media/JobPhotoMap';
import { JobPhotoMarkup } from '@/components/media/JobPhotoMarkup';
import { uploadProDriveFile } from '@/lib/drive/upload-client';

export interface JobPhoto {
  id: string;
  caption: string | null;
  takenAt: string;
  name: string;
  mimeType: string;
  url: string | null;
  tags: string[];
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  headingDeg: number | null;
  hidden: boolean;
  isCover: boolean;
  pairedPhotoId: string | null;
}

interface TeamMember {
  contactId: string;
  roleId: string;
  name: string;
  roleName: string;
}

interface ContactChoice {
  id: string;
  name: string;
  email: string;
}

interface RoleChoice {
  id: string;
  name: string;
  slug: string;
}

interface CommentRow {
  id: string;
  body: string;
  createdAt: string;
}

interface JobProjectChoice {
  id: string;
  name: string;
}

interface JobPhotoViewerProps {
  photo: JobPhoto;
  photos: JobPhoto[];
  projectId: string;
  projectName: string;
  customerId: string;
  customerName: string;
  address: string;
  onClose: () => void;
  onChanged: () => void;
  onTakeAfter: (photoId: string) => void;
}

type Sheet = 'comments' | 'team' | 'contacts' | 'invite' | 'role' | 'tags' | 'tasks' | 'newTask' | 'assignTask' | 'map' | 'menu' | 'move' | 'after' | null;

type TaskFilter = 'assigned' | 'incomplete' | 'complete' | 'unassigned';

interface PhotoTask {
  id: string;
  title: string;
  done: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
}

const SUGGESTED_TAGS = [
  'Back Side',
  'Before and After',
  'Bottom',
  'Clock In',
  'Clock Out',
  'Document',
  'East Side',
  'Finished',
  'Front Side',
  'Left Side',
  'Right Side',
  'Top',
] as const;

const fieldClass = 'w-full rounded-lg border-2 border-black px-3 py-2 text-sm';

/** Safari's bottom toolbar covers fixed content. This is the hidden strip, in pixels. */
function useBrowserBottomInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const measure = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(Math.max(0, Math.round(covered)));
    };
    measure();
    viewport.addEventListener('resize', measure);
    viewport.addEventListener('scroll', measure);
    return () => {
      viewport.removeEventListener('resize', measure);
      viewport.removeEventListener('scroll', measure);
    };
  }, []);
  return inset;
}

const FACING = ['dirN', 'dirNE', 'dirE', 'dirSE', 'dirS', 'dirSW', 'dirW', 'dirNW'] as const;

function facingKey(degrees: number): (typeof FACING)[number] {
  const turn = ((degrees % 360) + 360) % 360;
  return FACING[Math.round(turn / 45) % 8];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '•';
}

/**
 * One job photo. Comments, the job team, and the photo actions live here.
 * Team roles are the CRM contact roles (employee, subcontractor, project manager).
 */
export function JobPhotoViewer({
  photo,
  photos,
  projectId,
  projectName,
  customerName,
  address,
  onClose,
  onChanged,
  onTakeAfter,
}: JobPhotoViewerProps) {
  const t = useTranslations('jobsite');
  const locale = useLocale();
  const browserBottom = useBrowserBottomInset();
  const captionRef = useRef<HTMLInputElement>(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const [mapPoint, setMapPoint] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [hideApprox, setHideApprox] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [tags, setTags] = useState(photo.tags);
  const [tagPicks, setTagPicks] = useState<string[]>(photo.tags);
  const [tagQuery, setTagQuery] = useState('');
  const [tasks, setTasks] = useState<PhotoTask[]>([]);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('incomplete');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [contacts, setContacts] = useState<ContactChoice[]>([]);
  const [roles, setRoles] = useState<RoleChoice[]>([]);
  const [projects, setProjects] = useState<JobProjectChoice[]>([]);
  const [roleId, setRoleId] = useState('');
  const [roleReturn, setRoleReturn] = useState<Sheet>('invite');
  const [pendingContactId, setPendingContactId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sheet !== 'map') return;
    setHideApprox(false);
    if (photo.latitude != null && photo.longitude != null) {
      setMapPoint({ lat: photo.latitude, lng: photo.longitude, accuracy: photo.accuracyM });
      return;
    }
    const query = address.replace(/ · /g, ', ').trim();
    if (query.length < 5) {
      setMapPoint(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/geocode?address=${encodeURIComponent(query)}`, { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { coordinates?: { latitude?: number; longitude?: number } | null }) => {
        if (cancelled) return;
        const latitude = body.coordinates?.latitude;
        const longitude = body.coordinates?.longitude;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          setMapPoint(null);
          return;
        }
        setMapPoint({ lat: latitude, lng: longitude, accuracy: 80 });
        void fetch(`/api/crm/projects/${projectId}/photos/${photo.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ latitude, longitude, accuracyM: 80 }),
        }).then((response) => {
          if (response.ok) onChangedRef.current();
        });
      })
      .catch(() => {
        if (!cancelled) setMapPoint(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sheet, photo.latitude, photo.longitude, photo.accuracyM, photo.id, address, projectId]);

  useEffect(() => {
    setCaption(photo.caption ?? '');
    setTags(photo.tags);
    setTagPicks(photo.tags);
    setSheet(null);
    setError(null);
    setNotice(null);
  }, [photo.id]);

  const teamRoles = useMemo(() => {
    const rank: Record<string, number> = { employee: 0, subcontractor: 1, project_manager: 2, supplier: 3 };
    return roles
      .filter((role) => role.slug !== 'customer')
      .sort((a, b) => (rank[a.slug] ?? 9) - (rank[b.slug] ?? 9) || a.name.localeCompare(b.name));
  }, [roles]);

  const tagLabel = (value: string): string => {
    switch (value) {
      case 'Back Side': return t('tagBackSide');
      case 'Before and After': return t('tagBeforeAfter');
      case 'Bottom': return t('tagBottom');
      case 'Clock In': return t('tagClockIn');
      case 'Clock Out': return t('tagClockOut');
      case 'Document': return t('tagDocument');
      case 'East Side': return t('tagEastSide');
      case 'Finished': return t('tagFinished');
      case 'Front Side': return t('tagFrontSide');
      case 'Left Side': return t('tagLeftSide');
      case 'Right Side': return t('tagRightSide');
      case 'Top': return t('tagTop');
      default: return value;
    }
  };

  const loadTasks = async () => {
    const response = await fetch(`/api/crm/projects/${projectId}/photos/${photo.id}/tasks`, { credentials: 'include' });
    const body = (await response.json()) as { tasks?: PhotoTask[]; error?: string };
    if (!response.ok) throw new Error(body.error || t('loadFailed'));
    setTasks(body.tasks ?? []);
  };

  const roleHint = (slug: string): string | null => {
    if (slug === 'employee') return t('roleEmployee');
    if (slug === 'subcontractor') return t('roleSubcontractor');
    if (slug === 'project_manager') return t('roleProjectManager');
    if (slug === 'supplier') return t('roleSupplier');
    return null;
  };

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/crm/projects/${projectId}/photos/${photo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || t('saveFailed'));
      onChanged();
      return true;
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : t('saveFailed'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const loadComments = async () => {
    const response = await fetch(`/api/crm/projects/${projectId}/photos/${photo.id}/comments`, { credentials: 'include' });
    const body = (await response.json()) as { comments?: CommentRow[]; error?: string };
    if (!response.ok) throw new Error(body.error || t('loadFailed'));
    setComments(body.comments ?? []);
  };

  const loadMembers = async () => {
    const response = await fetch(`/api/crm/projects/${projectId}/members`, { credentials: 'include' });
    const body = (await response.json()) as { members?: TeamMember[]; error?: string };
    if (!response.ok) throw new Error(body.error || t('loadFailed'));
    setMembers(body.members ?? []);
  };

  const loadRoles = async () => {
    if (roles.length > 0) return;
    const response = await fetch('/api/crm/roles', { credentials: 'include' });
    const body = (await response.json()) as { roles?: RoleChoice[]; error?: string };
    if (!response.ok) throw new Error(body.error || t('loadFailed'));
    const next = body.roles ?? [];
    setRoles(next);
    const first = next.find((role) => role.slug === 'employee') ?? next.find((role) => role.slug !== 'customer');
    if (first) setRoleId((current) => current || first.id);
  };

  const openComments = () => {
    setSheet('comments');
    setError(null);
    void loadComments().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : t('loadFailed'));
    });
    void loadMembers().catch(() => undefined);
  };

  const saveCaption = () => {
    const next = caption.trim();
    if (next === (photo.caption ?? '')) return;
    void patch({ caption: next });
  };

  const addComment = async () => {
    const text = commentDraft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/crm/projects/${projectId}/photos/${photo.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: text }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || t('saveFailed'));
      setCommentDraft('');
      await loadComments();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const assignMember = async (contactId: string, assignedRoleId: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/crm/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ contactId, roleId: assignedRoleId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || t('saveFailed'));
      setPendingContactId(null);
      setSheet('team');
      await loadMembers();
      setNotice(t('teamAdded'));
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('saveFailed'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('needName'));
      return;
    }
    if (!email.trim() && !phone.trim()) {
      setError(t('needContact'));
      return;
    }
    if (!roleId) {
      setError(t('chooseRole'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await fetch('/api/crm/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          roleIds: [roleId],
        }),
      });
      const createdBody = (await created.json()) as { id?: string; error?: string };
      if (!created.ok || !createdBody.id) throw new Error(createdBody.error || t('saveFailed'));
      const added = await assignMember(createdBody.id, roleId);
      if (added) {
        setFirstName('');
        setLastName('');
        setEmail('');
        setPhone('');
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const openContacts = async () => {
    setSheet('contacts');
    setError(null);
    try {
      await loadRoles();
      const response = await fetch('/api/crm/customers?pageSize=100&sortBy=updated_at&sortDir=desc', { credentials: 'include' });
      const body = (await response.json()) as {
        customers?: { id: string; display_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null }[];
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || t('loadFailed'));
      setContacts((body.customers ?? []).map((row) => ({
        id: row.id,
        name: row.display_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Contact',
        email: row.email ?? '',
      })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('loadFailed'));
    }
  };

  const share = async () => {
    const text = caption.trim() || projectName;
    try {
      if (navigator.share) {
        await navigator.share({ title: projectName, text, url: photo.url ?? undefined });
        return;
      }
      if (photo.url) await navigator.clipboard.writeText(photo.url);
      setNotice(t('linkCopied'));
    } catch {
      setNotice(null);
    }
  };

  const saveToDevice = async () => {
    if (!photo.url) return;
    setBusy(true);
    setSheet(null);
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const name = photo.name || 'job-photo.jpg';
      const type = blob.type || photo.mimeType || 'image/jpeg';
      const file = new File([blob], name, { type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = name;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      }
      setNotice(t('photoDownloaded'));
    } catch (saveError) {
      if (saveError instanceof DOMException && saveError.name === 'AbortError') return;
      window.open(photo.url, '_blank', 'noopener,noreferrer');
    } finally {
      setBusy(false);
    }
  };

  const openDocument = () => {
    if (!photo.url) return;
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return;
    win.document.title = projectName;
    const heading = win.document.createElement('h1');
    heading.textContent = projectName;
    const image = win.document.createElement('img');
    image.src = photo.url;
    image.alt = '';
    image.style.maxWidth = '100%';
    win.document.body.append(heading, image);
    if (caption.trim()) {
      const paragraph = win.document.createElement('p');
      paragraph.textContent = caption.trim();
      win.document.body.append(paragraph);
    }
  };

  const openMove = async () => {
    setSheet('move');
    const response = await fetch('/api/crm/projects?pageSize=100', { credentials: 'include' });
    const body = (await response.json()) as { projects?: { id: string; name: string }[]; error?: string };
    if (!response.ok) {
      setError(body.error || t('loadFailed'));
      return;
    }
    setProjects((body.projects ?? []).filter((row) => row.id !== projectId));
  };

  const selectedRole = teamRoles.find((role) => role.id === roleId) ?? null;
  const when = new Date(photo.takenAt).toLocaleString(locale, { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const menu = [
    { icon: Tag, label: t('tag'), run: () => setSheet('tags') },
    { icon: Share2, label: t('share'), run: () => void share() },
    { icon: ImagePlus, label: t('takeAfter'), run: () => onTakeAfter(photo.id) },
    { icon: ImageIcon, label: t('chooseAfter'), run: () => setSheet('after') },
    { icon: photo.hidden ? Eye : EyeOff, label: photo.hidden ? t('showPhoto') : t('hidePhoto'), run: () => void patch({ hidden: !photo.hidden }).then(() => setSheet(null)) },
    { icon: Copy, label: t('duplicate'), run: () => void patch({ duplicate: true }).then((ok) => { if (ok) setSheet(null); }) },
    { icon: FolderInput, label: t('moveToProject'), run: () => void openMove() },
    { icon: Download, label: t('saveToDevice'), run: () => void saveToDevice() },
    { icon: ImageIcon, label: t('setCover'), run: () => void patch({ isCover: true }).then((ok) => { if (ok) setSheet(null); }) },
    { icon: BookOpen, label: t('document'), run: () => openDocument() },
    { icon: Trash2, label: t('trash'), run: () => void patch({ trash: true }).then((ok) => { if (ok) onClose(); }) },
  ];

  const saveMarkup = async (file: File) => {
    const infoResponse = await fetch(`/api/crm/projects/${projectId}/photos`, { credentials: 'include' });
    const info = (await infoResponse.json()) as {
      businessId?: string | null;
      project?: { displayId?: string };
      error?: string;
    };
    if (!infoResponse.ok || !info.businessId || !info.project?.displayId) {
      setError(info.error || t('noBusiness'));
      return;
    }
    const saved = await uploadProDriveFile({
      file,
      ownerType: 'business',
      ownerId: info.businessId,
      ensureFolderNames: ['Jobsites', info.project.displayId],
    });
    const ok = await patch({ driveFileId: saved.id });
    if (ok) setEditing(false);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 flex flex-col bg-black text-white" style={{ zIndex: 400 }}>
      {editing && photo.url ? (
        <JobPhotoMarkup url={photo.url} saving={busy} onClose={() => setEditing(false)} onSave={saveMarkup} />
      ) : null}
      <div className="flex items-center gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15" aria-label={t('closePhoto')}>
          <X className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center font-bold">{projectName}</p>
        <span className="h-10 w-10" />
      </div>

      <div className="relative min-h-0 flex-1">
        {photo.url && photo.mimeType.startsWith('video/') ? (
          <video src={photo.url} controls playsInline className="h-full w-full object-contain" />
        ) : photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="" className="h-full w-full object-contain" />
        ) : null}
        {photo.pairedPhotoId ? (
          <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-1 text-xs font-bold text-black">{t('afterPhoto')}</span>
        ) : null}
      </div>

      <div className="shrink-0 bg-black px-3" style={{ paddingBottom: `calc(${browserBottom}px + max(0.75rem, env(safe-area-inset-bottom)))` }}>
        {error ? <p className="mb-2 rounded-lg bg-red-600 px-3 py-2 text-sm">{error}</p> : null}
        {notice === t('photoDownloaded') ? (
          <p className="mb-2 flex items-center gap-2 rounded-lg bg-green-600 px-3 py-3 text-sm font-bold text-white">
            <Check className="h-5 w-5" />
            {notice}
          </p>
        ) : notice ? <p className="mb-2 rounded-lg bg-white px-3 py-2 text-sm text-black">{notice}</p> : null}
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-black">{initials(customerName)}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{customerName}</p>
            <p className="text-xs text-white/70">{when}</p>
          </div>
        </div>
        <input
          ref={captionRef}
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          onBlur={saveCaption}
          placeholder={t('descriptionPlaceholder')}
          maxLength={500}
          className="mb-3 w-full bg-transparent text-sm outline-none placeholder:text-white/50"
        />
        <div className="relative z-30 flex touch-manipulation items-center justify-between">
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40" aria-label={t('comments')} onClick={openComments}><MessageSquare className="h-5 w-5" /></button>
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40" aria-label={t('tag')} onClick={() => { setTagPicks(photo.tags); setTagQuery(''); setSheet('tags'); }}><Tag className="h-5 w-5" /></button>
          <button
            type="button"
            disabled={!photo.url || photo.mimeType.startsWith('video/')}
            className="flex h-12 w-12 touch-manipulation items-center justify-center rounded-full border border-white/40 disabled:opacity-40"
            aria-label={t('edit')}
            onPointerUp={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!photo.url || photo.mimeType.startsWith('video/')) return;
              setSheet(null);
              setEditing(true);
            }}
          >
            <Pencil className="h-5 w-5" />
          </button>
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40" aria-label={t('tasks')} onClick={() => { setSheet('tasks'); void loadTasks().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : t('loadFailed'))); }}><Check className="h-5 w-5" /></button>
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40" aria-label={t('map')} onClick={() => setSheet('map')}><MapPin className="h-5 w-5" /></button>
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-white/40" aria-label={t('menu')} onClick={() => setSheet('menu')}><MoreHorizontal className="h-5 w-5" /></button>
        </div>
      </div>

      {sheet === 'map' ? (
        <div className="absolute inset-0 z-20 flex flex-col bg-white text-black">
          <div className="relative min-h-0 flex-1 bg-gray-100">
            {mapPoint ? (
              <JobPhotoMap latitude={mapPoint.lat} longitude={mapPoint.lng} accuracyM={mapPoint.accuracy} />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-600">{t('noMapLocation')}</div>
            )}
            <button type="button" onClick={() => setSheet(null)} className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow" aria-label={t('closePhoto')}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="m-3 rounded-2xl border-2 border-black bg-white p-3 shadow">
            <div className="flex gap-3">
              {photo.url && !photo.mimeType.startsWith('video/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ) : <div className="h-16 w-16 rounded-lg bg-gray-200" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{projectName}</p>
                  <button type="button" onClick={() => setSheet(null)} aria-label={t('closePhoto')}><X className="h-4 w-4" /></button>
                </div>
                {address ? <p className="mt-1 flex items-center gap-1 text-sm text-gray-600"><MapPin className="h-3.5 w-3.5 shrink-0" />{address}</p> : null}
                <p className="mt-1 flex items-center gap-1 text-sm text-gray-600"><User className="h-3.5 w-3.5 shrink-0" />{customerName}</p>
                {photo.headingDeg != null ? (
                  <p className="mt-1 flex items-center gap-1 text-sm text-gray-600">
                    <Compass className="h-3.5 w-3.5 shrink-0" />
                    {t('facing', { direction: t(facingKey(photo.headingDeg)) })}
                  </p>
                ) : null}
              </div>
            </div>
            {mapPoint && !hideApprox ? (
              <p className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm">
                {t('locationsApproximate')}
                <button type="button" onClick={() => setHideApprox(true)} aria-label={t('closePhoto')}><X className="h-4 w-4" /></button>
              </p>
            ) : !mapPoint ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm">{t('noMapLocation')}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {sheet && sheet !== 'map' ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/40">
          <button type="button" className="min-h-0 flex-1" aria-label={t('closePhoto')} onClick={() => setSheet(sheet === 'role' ? roleReturn : null)} />
          <div className="max-h-[80%] overflow-y-auto rounded-t-3xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-black">
            {sheet === 'comments' ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold">{t('comments')}</h2>
                  <button type="button" onClick={() => setSheet(null)} aria-label={t('closePhoto')}><X className="h-5 w-5" /></button>
                </div>
                {comments.length === 0 ? <p className="py-8 text-center text-sm text-gray-600">{t('noComments')}</p> : (
                  <ul className="space-y-3">
                    {comments.map((comment) => (
                      <li key={comment.id} className="rounded-lg border-2 border-black px-3 py-2">
                        <p className="text-sm">{comment.body}</p>
                        <p className="mt-1 text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString(locale)}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" onClick={() => { setSheet('team'); void loadMembers(); }} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-black py-3 font-medium text-white">
                  <Users className="h-4 w-4" />
                  {t('addTeam')}
                </button>
                <div className="mt-3 flex gap-2">
                  <input value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder={t('addComment')} className={fieldClass} />
                  <button type="button" disabled={busy} onClick={() => void addComment()} className="rounded-full bg-black px-4 text-sm font-bold text-white disabled:opacity-40">{t('save')}</button>
                </div>
              </>
            ) : null}

            {sheet === 'team' ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-bold">{t('addTeam')}</h2>
                  <button type="button" onClick={() => setSheet('comments')} aria-label={t('closePhoto')}><X className="h-5 w-5" /></button>
                </div>
                {members.length === 0 ? <p className="mb-4 text-sm text-gray-600">{t('teamEmpty')}</p> : (
                  <ul className="mb-4 space-y-2">
                    {members.map((member) => (
                      <li key={member.contactId} className="flex items-center justify-between gap-2 rounded-lg border-2 border-black px-3 py-2">
                        <span>
                          <span className="block font-bold">{member.name}</span>
                          <span className="text-xs text-gray-600">{member.roleName}</span>
                        </span>
                        <button
                          type="button"
                          className="text-sm underline"
                          onClick={() => void fetch(`/api/crm/projects/${projectId}/members/${member.contactId}`, { method: 'DELETE', credentials: 'include' }).then(() => loadMembers())}
                        >
                          {t('remove')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => void openContacts()} className="flex-1 rounded-full border-2 border-black py-3 text-sm font-bold">{t('fromContacts')}</button>
                  <button type="button" onClick={() => { setSheet('invite'); void loadRoles().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : t('loadFailed'))); }} className="flex-1 rounded-full bg-black py-3 text-sm font-bold text-white">{t('enterManually')}</button>
                </div>
              </>
            ) : null}

            {sheet === 'contacts' ? (
              <>
                <h2 className="mb-3 text-lg font-bold">{t('fromContacts')}</h2>
                <ul className="space-y-2">
                  {contacts.map((contact) => (
                    <li key={contact.id}>
                      <button
                        type="button"
                        className="w-full rounded-lg border-2 border-black px-3 py-2 text-left"
                        onClick={() => {
                          setPendingContactId(contact.id);
                          setRoleReturn('contacts');
                          setSheet('role');
                          void loadRoles();
                        }}
                      >
                        <span className="block font-bold">{contact.name}</span>
                        {contact.email ? <span className="text-xs text-gray-600">{contact.email}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {sheet === 'invite' ? (
              <>
                <h2 className="mb-3 text-lg font-bold">{t('inviteUser')}</h2>
                <div className="grid grid-cols-2 gap-2">
                  <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder={t('firstName')} className={fieldClass} />
                  <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder={t('lastName')} className={fieldClass} />
                </div>
                <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('workEmail')} className={`${fieldClass} mt-2`} inputMode="email" />
                <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={t('phoneNumber')} className={`${fieldClass} mt-2`} inputMode="tel" />
                <button type="button" onClick={() => { setPendingContactId(null); setRoleReturn('invite'); setSheet('role'); void loadRoles(); }} className={`${fieldClass} mt-2 text-left`}>
                  {selectedRole ? selectedRole.name : t('userRole')}
                </button>
                <button type="button" disabled={busy} onClick={() => void invite()} className="mt-4 w-full rounded-full bg-black py-3 font-medium text-white disabled:opacity-40">{t('inviteUser')}</button>
              </>
            ) : null}

            {sheet === 'role' ? (
              <>
                <h2 className="mb-3 text-lg font-bold">{t('userRole')}</h2>
                <ul className="space-y-2">
                  {teamRoles.map((role) => (
                    <li key={role.id}>
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 rounded-lg border-2 border-black px-3 py-2 text-left"
                        onClick={() => {
                          setRoleId(role.id);
                          if (pendingContactId) void assignMember(pendingContactId, role.id);
                          else setSheet('invite');
                        }}
                      >
                        <span className={`mt-1 h-4 w-4 rounded-full border-2 border-black ${role.id === roleId ? 'bg-black' : ''}`} />
                        <span>
                          <span className="block font-bold">{role.name}</span>
                          {roleHint(role.slug) ? <span className="text-xs text-gray-600">{roleHint(role.slug)}</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {sheet === 'tags' ? (
              <>
                <h2 className="mb-3 text-center text-lg font-bold">{t('applyTags')}</h2>
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input value={tagQuery} onChange={(event) => setTagQuery(event.target.value)} placeholder={t('findOrCreateTag')} className={`${fieldClass} pl-9`} />
                </div>
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {(() => {
                    const needle = tagQuery.trim().toLowerCase();
                    const known = [...new Set([...SUGGESTED_TAGS, ...tagPicks])];
                    const visible = known.filter((tag) => !needle || tagLabel(tag).toLowerCase().includes(needle) || tag.toLowerCase().includes(needle));
                    const canCreate = needle.length > 0 && !known.some((tag) => tag.toLowerCase() === needle);
                    return (
                      <>
                        {canCreate ? (
                          <li>
                            <button type="button" className="w-full py-3 text-left font-medium" onClick={() => setTagPicks((current) => current.includes(tagQuery.trim()) ? current : [...current, tagQuery.trim()].slice(0, 30))}>
                              {t('createTag', { name: tagQuery.trim() })}
                            </button>
                          </li>
                        ) : null}
                        {visible.map((tag) => {
                          const checked = tagPicks.includes(tag);
                          return (
                            <li key={tag}>
                              <button type="button" className="flex w-full items-center justify-between py-3 text-left" onClick={() => setTagPicks((current) => checked ? current.filter((item) => item !== tag) : [...current, tag].slice(0, 30))}>
                                <span>{tagLabel(tag)}</span>
                                <span className={`h-5 w-5 rounded border-2 border-black ${checked ? 'bg-black' : 'bg-white'}`} />
                              </button>
                            </li>
                          );
                        })}
                      </>
                    );
                  })()}
                </ul>
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setSheet(null)} className="flex-1 rounded-full border-2 border-black py-3 font-medium">{t('cancel')}</button>
                  <button type="button" disabled={busy} onClick={() => { setTags(tagPicks); void patch({ tags: tagPicks }).then((ok) => { if (ok) setSheet(null); }); }} className="flex-1 rounded-full bg-black py-3 font-medium text-white disabled:opacity-40">{t('apply')}</button>
                </div>
              </>
            ) : null}

            {sheet === 'tasks' ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <button type="button" onClick={() => setSheet(null)} aria-label={t('closePhoto')}><X className="h-5 w-5" /></button>
                  <h2 className="text-lg font-bold">{t('tasks')}</h2>
                  <span className="w-5" />
                </div>
                <div className="mb-3 flex gap-2 overflow-x-auto">
                  {(['assigned', 'incomplete', 'complete', 'unassigned'] as const).map((filter) => (
                    <button key={filter} type="button" onClick={() => setTaskFilter(filter)} className={`shrink-0 rounded-full px-3 py-1 text-sm ${taskFilter === filter ? 'bg-black text-white' : 'bg-gray-100'}`}>
                      {filter === 'assigned' ? t('taskAssigned') : filter === 'incomplete' ? t('taskIncomplete') : filter === 'complete' ? t('taskComplete') : t('taskUnassigned')}
                    </button>
                  ))}
                </div>
                <ul className="space-y-2">
                  {tasks.filter((task) => {
                    if (taskFilter === 'complete') return task.done;
                    if (taskFilter === 'unassigned') return !task.assigneeId;
                    if (taskFilter === 'assigned') return Boolean(task.assigneeId);
                    return !task.done;
                  }).map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-2 py-2">
                      <button type="button" className="flex min-w-0 items-center gap-2 text-left" onClick={() => void fetch(`/api/crm/projects/${projectId}/photos/${photo.id}/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ done: !task.done }) }).then(() => loadTasks())}>
                        <span className={`h-5 w-5 shrink-0 rounded-full border-2 border-black ${task.done ? 'bg-black' : ''}`} />
                        <span className={task.done ? 'truncate text-gray-400 line-through' : 'truncate'}>{task.title}</span>
                      </button>
                      {task.assigneeName ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-black text-[10px] font-bold">{initials(task.assigneeName)}</span> : null}
                    </li>
                  ))}
                </ul>
                {tasks.length === 0 ? <p className="py-6 text-center text-sm text-gray-600">{t('noTasks')}</p> : null}
                <button type="button" onClick={() => { setTaskTitle(t('untitledTask')); setTaskAssigneeId(null); setSheet('newTask'); void loadMembers().catch(() => undefined); }} className="mt-4 flex items-center gap-2 font-medium">
                  <Plus className="h-4 w-4" />
                  {t('tasks')}
                </button>
              </>
            ) : null}

            {sheet === 'newTask' ? (
              <>
                <button type="button" onClick={() => setSheet('tasks')} aria-label={t('closePhoto')}><X className="h-5 w-5" /></button>
                <p className="mt-2 text-sm">{t('newTask')}</p>
                <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} className="mt-1 w-full border-b-2 border-black py-2 text-2xl font-medium outline-none" />
                <div className="mt-6 flex items-center justify-between gap-3">
                  <button type="button" onClick={() => setSheet('assignTask')} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-black" aria-label={t('assignUsers')}>
                    <Users className="h-4 w-4" />
                  </button>
                  <button type="button" disabled={busy || !taskTitle.trim()} onClick={() => {
                    setBusy(true);
                    void fetch(`/api/crm/projects/${projectId}/photos/${photo.id}/tasks`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ title: taskTitle.trim(), assigneeId: taskAssigneeId }),
                    }).then(async (response) => {
                      if (!response.ok) {
                        const body = (await response.json()) as { error?: string };
                        throw new Error(body.error || t('saveFailed'));
                      }
                      await loadTasks();
                      setSheet('tasks');
                    }).catch((saveError: unknown) => {
                      setError(saveError instanceof Error ? saveError.message : t('saveFailed'));
                    }).finally(() => setBusy(false));
                  }} className="rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-40">{t('createTask')}</button>
                </div>
                {taskAssigneeId ? <p className="mt-2 text-sm text-gray-600">{members.find((member) => member.contactId === taskAssigneeId)?.name}</p> : null}
              </>
            ) : null}

            {sheet === 'assignTask' ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <button type="button" className="text-sm" onClick={() => setSheet('newTask')}>{t('cancel')}</button>
                  <h2 className="font-bold">{t('assignUsers')}</h2>
                  <button type="button" className="text-sm font-bold" onClick={() => setSheet('newTask')}>{t('apply')}</button>
                </div>
                <ul className="space-y-2">
                  {members.map((member) => (
                    <li key={member.contactId}>
                      <button type="button" className="flex w-full items-center gap-3 py-2 text-left" onClick={() => setTaskAssigneeId(taskAssigneeId === member.contactId ? null : member.contactId)}>
                        <span className={`h-5 w-5 rounded border-2 border-black ${taskAssigneeId === member.contactId ? 'bg-black' : ''}`} />
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black text-xs font-bold">{initials(member.name)}</span>
                        <span className="font-medium">{member.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {members.length === 0 ? <p className="py-4 text-sm text-gray-600">{t('teamEmpty')}</p> : null}
              </>
            ) : null}

            {sheet === 'menu' ? (
              <ul>
                {menu.map((item) => (
                  <li key={item.label}>
                    <button type="button" onClick={item.run} className="flex w-full items-center gap-3 py-3 text-left">
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {sheet === 'move' ? (
              <>
                <h2 className="mb-3 text-lg font-bold">{t('moveToProject')}</h2>
                <ul className="space-y-2">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <button type="button" className="w-full rounded-lg border-2 border-black px-3 py-2 text-left font-bold" onClick={() => void patch({ moveToProjectId: project.id }).then((ok) => { if (ok) onClose(); })}>
                        {project.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {sheet === 'after' ? (
              <>
                <h2 className="mb-3 text-lg font-bold">{t('chooseAfter')}</h2>
                <div className="grid grid-cols-3 gap-1">
                  {photos.filter((item) => item.id !== photo.id && item.url).map((item) => (
                    <button key={item.id} type="button" className="aspect-square overflow-hidden bg-gray-200" onClick={() => void patch({ pairedPhotoId: item.id }).then((ok) => { if (ok) setSheet(null); })}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url ?? ''} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>,
    document.body
  );
}
