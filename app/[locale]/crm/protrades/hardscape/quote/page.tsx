'use client';

import { TradeGate } from '@/components/protrades/TradeGate';
import { HardscapeProQuote } from '@/components/protrades/HardscapeProQuote';

export default function HardscapeProQuotePage() {
  return (
    <TradeGate trade="hardscape">
      <HardscapeProQuote />
    </TradeGate>
  );
}
