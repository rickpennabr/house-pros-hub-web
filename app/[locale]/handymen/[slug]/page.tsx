import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InstallerShare } from '@/app/[locale]/installers/[slug]/installer-share'

interface HandymanPageProps {
  params: Promise<{ locale: string; slug: string }>
}

export async function generateMetadata({ params }: HandymanPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: handyman } = await supabase
    .from('handyman_profiles')
    .select('display_name, bio, service_area')
    .eq('slug', slug)
    .maybeSingle()

  const name = handyman?.display_name ?? 'Handyman'
  const description =
    handyman?.bio?.slice(0, 160) ||
    (handyman?.service_area ? `${name} serves ${handyman.service_area}.` : `${name} on House Pros Hub.`)

  return {
    title: `${name} | Handyman`,
    description,
  }
}

export default async function HandymanDetailsPage({ params }: HandymanPageProps) {
  const { locale, slug } = await params
  const supabase = await createClient()
  const { data: handyman } = await supabase
    .from('handyman_profiles')
    .select('display_name, photo_url, phone, email, bio, trades, service_area, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (!handyman) notFound()

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-2 md:p-0 bg-white">
      <main className="mx-auto flex h-[calc(100vh-1rem)] min-h-0 w-full max-w-[960px] flex-col overflow-y-auto overflow-x-hidden rounded-lg border-2 border-black bg-white px-4 py-8 text-black md:my-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Handyman</p>
        <div className="mt-4 flex items-center gap-4">
          {handyman.photo_url ? (
            <img
              src={handyman.photo_url}
              alt=""
              className="h-20 w-20 rounded-lg border-2 border-black object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-black bg-black text-2xl font-bold text-white">
              {handyman.display_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-semibold">{handyman.display_name}</h1>
            {handyman.service_area ? <p className="text-sm text-gray-600">{handyman.service_area}</p> : null}
          </div>
        </div>

        {handyman.trades.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {handyman.trades.map((trade) => (
              <span key={trade} className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white">
                {trade}
              </span>
            ))}
          </div>
        ) : null}

        {handyman.bio ? <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed">{handyman.bio}</p> : null}

        <dl className="mt-6 space-y-2 text-sm">
          {handyman.phone ? (
            <div>
              <dt className="font-semibold">Phone</dt>
              <dd>
                <a href={`tel:${handyman.phone}`} className="text-red-600">
                  {handyman.phone}
                </a>
              </dd>
            </div>
          ) : null}
          {handyman.email ? (
            <div>
              <dt className="font-semibold">Email</dt>
              <dd>
                <a href={`mailto:${handyman.email}`} className="text-red-600">
                  {handyman.email}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>

        <InstallerShare path={`/${locale}/handymen/${handyman.slug}`} />
      </main>
    </div>
  )
}
