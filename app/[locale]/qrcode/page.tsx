'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAuth } from '@/contexts/AuthContext'
import { MyQrCode } from '@/components/qr/MyQrCode'

export default function AccountQrCodePage() {
  const { roles, isLoading } = useAuth()
  const router = useRouter()
  const locale = useLocale()
  const list = roles as string[]
  const usesCrm = list.includes('contractor') || list.includes('realtor')
  const isInstaller = list.includes('installer')

  useEffect(() => {
    if (isLoading) return
    if (usesCrm) {
      router.replace(`/${locale}/crm/qrcode`)
      return
    }
    if (!isInstaller) router.replace(`/${locale}/account-management`)
  }, [isLoading, usesCrm, isInstaller, locale, router])

  if (isLoading || usesCrm || !isInstaller) return <p className="p-6 text-sm text-gray-600">Loading…</p>
  return (
    <div className="p-4 md:p-6">
      <MyQrCode />
    </div>
  )
}
