import { notFound, permanentRedirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface InstallerPageProps {
  params: Promise<{ locale: string; slug: string }>
}

/** No installers for now: an old installer link opens that person's handyman page (migration 182). */
export default async function InstallerDetailsPage({ params }: InstallerPageProps) {
  const { locale, slug } = await params
  const supabase = await createClient()
  const { data: installer } = await supabase.from('installer_profiles').select('user_id').eq('slug', slug).maybeSingle()
  if (!installer?.user_id) notFound()
  const { data: handyman } = await supabase.from('handyman_profiles').select('slug').eq('user_id', installer.user_id).maybeSingle()
  if (!handyman?.slug) notFound()
  permanentRedirect(`/${locale}/handymen/${handyman.slug}`)
}
