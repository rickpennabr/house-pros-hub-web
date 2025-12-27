import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function TermsOfServicePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.terms.sections' });
  return (
    <div className="max-w-4xl mx-auto pb-8 md:pb-12">
      <div className="bg-white pb-6 md:pb-8">
          <div className="prose prose-sm max-w-none text-gray-800 space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('agreementToTerms.title')}</h2>
              <p>
                {t('agreementToTerms.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('platformDescription.title')}</h2>
              <p>
                {t('platformDescription.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('userAccounts.title')}</h2>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">{t('userAccounts.accountRegistration.title')}</h3>
              <p>
                {t('userAccounts.accountRegistration.content')}
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">{t('userAccounts.accountSecurity.title')}</h3>
              <p>
                {t('userAccounts.accountSecurity.content')}
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">{t('userAccounts.accountEligibility.title')}</h3>
              <p>
                {t('userAccounts.accountEligibility.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('userResponsibilities.title')}</h2>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">{t('userResponsibilities.prohibitedActivities.title')}</h3>
              <p>{t('userResponsibilities.prohibitedActivities.content')}</p>
              <ul className="list-disc pl-6 space-y-2">
                {t.raw('userResponsibilities.prohibitedActivities.items').map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('contractorResponsibilities.title')}</h2>
              <p>{t('contractorResponsibilities.content')}</p>
              <ul className="list-disc pl-6 space-y-2">
                {t.raw('contractorResponsibilities.items').map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
              <p className="mt-4">
                <strong>{t('contractorResponsibilities.independentContractor').split(':')[0]}:</strong> {t('contractorResponsibilities.independentContractor').split(':').slice(1).join(':')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('customerResponsibilities.title')}</h2>
              <p>{t('customerResponsibilities.content')}</p>
              <ul className="list-disc pl-6 space-y-2">
                {t.raw('customerResponsibilities.items').map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('payments.title')}</h2>
              <p>
                {t('payments.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('platformLiability.title')}</h2>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">{t('platformLiability.noWarranty.title')}</h3>
              <p>
                {t('platformLiability.noWarranty.content')}
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">{t('platformLiability.noResponsibility.title')}</h3>
              <p>
                {t('platformLiability.noResponsibility.content')}
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">{t('platformLiability.notAParty.title')}</h3>
              <p>
                {t('platformLiability.notAParty.content')}
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">{t('platformLiability.userGeneratedContent.title')}</h3>
              <p>
                {t('platformLiability.userGeneratedContent.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('limitationOfLiability.title')}</h2>
              <p>
                {t('limitationOfLiability.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('indemnification.title')}</h2>
              <p>
                {t('indemnification.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('intellectualProperty.title')}</h2>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">{t('intellectualProperty.platformContent.title')}</h3>
              <p>
                {t('intellectualProperty.platformContent.content')}
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">{t('intellectualProperty.userContent.title')}</h3>
              <p>
                {t('intellectualProperty.userContent.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('disputeResolution.title')}</h2>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">{t('disputeResolution.platformDisputes.title')}</h3>
              <p>
                {t('disputeResolution.platformDisputes.content')}
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">{t('disputeResolution.disputesWithHub.title')}</h3>
              <p>
                {t('disputeResolution.disputesWithHub.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('termination.title')}</h2>
              <p>
                {t('termination.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('modifications.title')}</h2>
              <p>
                {t('modifications.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('governingLaw.title')}</h2>
              <p>
                {t('governingLaw.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('contact.title')}</h2>
              <p>
                {t('contact.content')}
              </p>
              <p className="mt-2">
                <strong>{t('contact.email')}</strong> legal@houseproshub.com<br />
                <strong>{t('contact.address')}</strong> {t('contact.addressValue')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('severability.title')}</h2>
              <p>
                {t('severability.content')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('entireAgreement.title')}</h2>
              <p>
                {t('entireAgreement.content')}
              </p>
            </section>
          </div>
        </div>
    </div>
  );
}

