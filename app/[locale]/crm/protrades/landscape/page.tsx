'use client';

import { TradeGate } from '@/components/protrades/TradeGate';
import { TradeCatalogBrowser } from '@/components/protrades/TradeCatalogBrowser';

export default function ProTradeLandscapePage() {
  return (
    <TradeGate trade="landscape">
      <TradeCatalogBrowser trade="landscape" />
    </TradeGate>
  );
}
