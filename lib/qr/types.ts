export type QrDevice = 'phone' | 'tablet' | 'computer'

export interface ScanStats {
  total: number
  today: number
  days7: number
  days30: number
  unique30: number
  byDevice: Record<QrDevice, number>
  days: Array<{ date: string; count: number }>
}
