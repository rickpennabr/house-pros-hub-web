import type { ReactNode } from 'react';
import { TradeGate } from '@/components/protrades/TradeGate';

/** Maintenance belongs to the Landscape ProTrade. */
export default function MaintenanceLayout({ children }: { children: ReactNode }) {
  return <TradeGate trade="landscape">{children}</TradeGate>;
}
