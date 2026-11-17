'use client';

import { useSearchParams } from 'next/navigation';
import { MaintenanceVisitFlow } from '@/components/maintenance/MaintenanceVisitFlow';

export default function MaintenancePage() {
  const searchParams = useSearchParams();
  const autoStart = searchParams.get('new') === '1';

  // Remount when ?new=1 toggles so the Add menu can reopen the start form.
  return <MaintenanceVisitFlow key={autoStart ? 'new' : 'list'} autoStart={autoStart} />;
}
