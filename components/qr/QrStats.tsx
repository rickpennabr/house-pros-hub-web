'use client'

import type { ScanStats } from '@/lib/qr/types'

export function QrStats({ stats }: { stats: ScanStats }) {
  const peak = Math.max(1, ...stats.days.map((day) => day.count))
  const cards = [
    { label: 'All scans', value: stats.total },
    { label: 'Today', value: stats.today },
    { label: 'Last 7 days', value: stats.days7 },
    { label: 'Last 30 days', value: stats.days30 },
    { label: 'People, 30 days', value: stats.unique30 },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {cards.map((card) => (
          <div key={card.label} className="border-2 border-black rounded-lg p-3">
            <p className="text-2xl font-semibold">{card.value}</p>
            <p className="text-xs text-gray-600">{card.label}</p>
          </div>
        ))}
      </div>
      <div className="border-2 border-black rounded-lg p-3">
        <p className="text-sm font-medium mb-3">Scans by day</p>
        <div className="flex items-end gap-1 h-24">
          {stats.days.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className="w-full bg-black rounded-sm"
                style={{ height: `${Math.max(4, (day.count / peak) * 100)}%` }}
                title={`${day.date}: ${day.count}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Phone {stats.byDevice.phone} · Tablet {stats.byDevice.tablet} · Computer {stats.byDevice.computer}
        </p>
      </div>
    </div>
  )
}
