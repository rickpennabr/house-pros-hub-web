'use client';

import { TradeGate } from '@/components/protrades/TradeGate';
import { TradeCatalogBrowser } from '@/components/protrades/TradeCatalogBrowser';

export default function ProTradeHardscapePage() {
  return (
    <TradeGate trade="hardscape">
      <TradeCatalogBrowser trade="hardscape" />
    </TradeGate>
  );
}
