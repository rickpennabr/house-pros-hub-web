'use client';

import { useMemo, useState } from 'react';
import { TbUserEdit } from 'react-icons/tb';
import { Building, Building2, CheckCircle2, Home as HomeIcon, MapPin, UserRound } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { EstimateSchema } from '@/lib/schemas/estimate';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import AddressAutocomplete, { AddressData } from '@/components/AddressAutocomplete';
import Accordion from '@/components/ui/Accordion';
import ProAccordion from '@/components/ui/ProAccordion';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';

interface CustomerInfoAccordionProps {
  isOpen: boolean;
  onToggle: () => void;
  isComplete: boolean;
  methods: UseFormReturn<EstimateSchema>;
  errors: UseFormReturn<EstimateSchema>['formState']['errors'];
  isSubmitting: boolean;
  onAddressSelect: (addressData: AddressData) => void;
  tFields: (key: string) => string;
  tAccordion: (key: string) => string;
  tTips: (key: string) => string;
  /** When true, show a message asking the customer to confirm or update the pre-filled profile address. */
  addressPrefilledFromProfile?: boolean;
  /** When true, the profile already has name, email and phone, so Personal Information starts collapsed. */
  personalInfoFromProfile?: boolean;
  /** The customer's My Places with a full address. When there are any, the address is picked from them. */
  places?: EstimatePlaceOption[];
  /** Still finding out whether the customer has places: show a placeholder, not the empty address form. */
  placesLoading?: boolean;
  selectedPlaceId?: string | null;
  onSelectPlace?: (place: EstimatePlaceOption) => void;
}

/** A My Places property the estimate can be for. */
export interface EstimatePlaceOption {
  id: string;
  kind: 'house' | 'business' | 'building';
  name: string;
  street: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
  photoUrl: string | null;
}

/** Same icons and size as the My Places cards. */
function PlaceKindIcon({ kind }: { kind: EstimatePlaceOption['kind'] }) {
  if (kind === 'business') return <Building2 className="h-7 w-7 text-red-600" aria-hidden />;
  if (kind === 'building') return <Building className="h-7 w-7 text-red-600" aria-hidden />;
  return <HomeIcon className="h-7 w-7 text-red-600" aria-hidden />;
}

export default function CustomerInfoAccordion({
  isOpen,
  onToggle,
  isComplete,
  methods,
  errors,
  isSubmitting,
  onAddressSelect,
  tFields,
  tAccordion,
  tTips,
  addressPrefilledFromProfile = false,
  personalInfoFromProfile = false,
  places = [],
  placesLoading = false,
  selectedPlaceId = null,
  onSelectPlace,
}: CustomerInfoAccordionProps) {
  const { register, watch, setValue } = methods;
  const streetAddress = watch('streetAddress');
  /** The customer chose to type an address that is not one of their places. */
  const [typingOtherAddress, setTypingOtherAddress] = useState(false);
  const addressHasErrors = Boolean(errors.streetAddress || errors.city || errors.state || errors.zipCode);
  const showPlacePicker = places.length > 0 && !typingOtherAddress;

  // Typing animation for placeholders
  const firstNamePlaceholder = tFields('firstNamePlaceholder');
  const lastNamePlaceholder = tFields('lastNamePlaceholder');
  const emailPlaceholder = tFields('emailPlaceholder');
  const phonePlaceholder = tFields('phonePlaceholder');
  const streetAddressPlaceholder = tFields('streetAddressPlaceholder');
  const placeholders = useMemo(
    () => [firstNamePlaceholder, lastNamePlaceholder, emailPlaceholder, phonePlaceholder, streetAddressPlaceholder],
    [firstNamePlaceholder, lastNamePlaceholder, emailPlaceholder, phonePlaceholder, streetAddressPlaceholder]
  );
  const animatedPlaceholders = useTypingPlaceholder({
    placeholders,
    typingSpeed: 50,
    delayBetweenFields: 300,
    startDelay: 500,
  });

  // Check if there are any errors in customer info fields
  const hasErrors = Boolean(
    errors.firstName ||
    errors.lastName ||
    errors.email ||
    errors.phone ||
    errors.streetAddress ||
    errors.city ||
    errors.state ||
    errors.zipCode
  );

  // Show missing info indicator when accordion is collapsed and info is incomplete
  const showMissingInfo = !isOpen && !isComplete;

  // Collapse Personal Information when the profile already filled it, but reopen it if a field there fails validation.
  const personalHasErrors = Boolean(errors.firstName || errors.lastName || errors.email || errors.phone);
  const [personalOpen, setPersonalOpen] = useState(!personalInfoFromProfile);
  if (personalHasErrors && !personalOpen) setPersonalOpen(true);

  return (
    <Accordion
      title={tAccordion('customerInfo')}
      isOpen={isOpen}
      onToggle={onToggle}
      isComplete={isComplete}
      icon={<TbUserEdit className="w-5 h-5" />}
      required
      hasErrors={hasErrors || !isComplete}
      missingInfoMessage={showMissingInfo ? tAccordion('missingRequiredInfo') : undefined}
      tip={tTips('customerInfo')}
    >
      <ProAccordion
        title={tAccordion('personalInfo')}
        icon={<UserRound className="w-5 h-5" />}
        isOpen={personalOpen}
        onToggle={setPersonalOpen}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label={tFields('firstNameLabel')} required error={errors.firstName?.message}>
            <Input
              {...register('firstName')}
              placeholder={animatedPlaceholders[0]}
              disabled={isSubmitting}
              error={errors.firstName?.message}
            />
          </FormField>

          <FormField label={tFields('lastNameLabel')} required error={errors.lastName?.message}>
            <Input
              {...register('lastName')}
              placeholder={animatedPlaceholders[1]}
              disabled={isSubmitting}
              error={errors.lastName?.message}
            />
          </FormField>
        </div>

        <FormField label={tFields('emailLabel')} required error={errors.email?.message}>
          <Input
            {...register('email')}
            type="email"
            placeholder={animatedPlaceholders[2]}
            disabled={isSubmitting}
            error={errors.email?.message}
          />
        </FormField>

        <FormField label={tFields('phoneLabel')} required error={errors.phone?.message}>
          <Input
            {...register('phone')}
            type="tel"
            placeholder={animatedPlaceholders[3]}
            disabled={isSubmitting}
            error={errors.phone?.message}
            onChange={(e) => {
              const formatted = formatPhoneNumber(e.target.value);
              setValue('phone', formatted, { shouldValidate: true });
            }}
          />
        </FormField>
      </ProAccordion>

      <ProAccordion
        divider
        title={tAccordion('projectAddress')}
        icon={<MapPin className="w-5 h-5" />}
      >
        {placesLoading ? (
          <div className="space-y-3" aria-busy="true" aria-live="polite">
            <div className="h-4 w-64 max-w-full animate-pulse rounded-md bg-gray-200" />
            <div className="flex h-[84px] w-full max-w-[290px] items-center gap-3 rounded-lg border-2 border-gray-200 p-2">
              <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded-md bg-gray-200" />
                <div className="h-3 w-24 animate-pulse rounded-md bg-gray-200" />
                <div className="h-3 w-28 animate-pulse rounded-md bg-gray-200" />
              </div>
            </div>
          </div>
        ) : showPlacePicker ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">{tAccordion('pickPlaceHint')}</p>
            {addressHasErrors ? (
              <p className="text-sm font-medium text-red-600" role="alert">
                {tAccordion('pickPlaceRequired')}
              </p>
            ) : null}
            {/* Same card as My Places: black border, 64px photo tile, red kind icon. */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2" role="radiogroup" aria-label={tAccordion('projectAddress')}>
              {places.map((place) => {
                const selected = place.id === selectedPlaceId;
                return (
                  <button
                    key={place.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={isSubmitting}
                    onClick={() => onSelectPlace?.(place)}
                    className={`relative flex items-center gap-3 rounded-lg border-2 border-black p-2 pr-9 text-left transition-colors disabled:opacity-60 ${
                      selected ? 'bg-gray-50 ring-2 ring-red-600 ring-offset-2' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-black bg-gray-50">
                      {place.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- signed My Places photo URL
                        <img src={place.photoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <PlaceKindIcon kind={place.kind} />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-black">{place.name}</span>
                      <span className="block truncate text-xs text-gray-600">
                        {place.apartment ? `${place.street}, ${place.apartment}` : place.street}
                      </span>
                      <span className="mt-0.5 block truncate text-xs">
                        {`${place.city}, ${place.state} ${place.zipCode}`}
                      </span>
                    </span>
                    {selected ? (
                      <CheckCircle2 className="absolute right-2 top-2 h-5 w-5 text-red-600" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setTypingOtherAddress(true);
                setValue('streetAddress', '', { shouldValidate: false });
                setValue('apartment', '', { shouldValidate: false });
                setValue('city', '', { shouldValidate: false });
                setValue('zipCode', '', { shouldValidate: false });
              }}
              className="text-sm font-medium text-black underline hover:no-underline"
            >
              {tAccordion('useOtherAddress')}
            </button>
          </div>
        ) : (
          <>
        {places.length > 0 ? (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setTypingOtherAddress(false);
              // Back to the cards: restore the picked place, or start with none picked.
              const back = places.find((place) => place.id === selectedPlaceId);
              if (back) {
                onSelectPlace?.(back);
              } else {
                setValue('streetAddress', '', { shouldValidate: false });
                setValue('apartment', '', { shouldValidate: false });
                setValue('city', '', { shouldValidate: false });
                setValue('zipCode', '', { shouldValidate: false });
              }
            }}
            className="text-sm font-medium text-black underline hover:no-underline"
          >
            {tAccordion('chooseFromMyPlaces')}
          </button>
        ) : addressPrefilledFromProfile ? (
          <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            {tAccordion('confirmAddressFromProfile')}
          </p>
        ) : null}

        <FormField label={tFields('streetAddressLabel')} required error={errors.streetAddress?.message}>
          <AddressAutocomplete
            value={streetAddress || ''}
            onChange={(value) => setValue('streetAddress', value, { shouldValidate: true })}
            onAddressSelect={onAddressSelect}
            placeholder={animatedPlaceholders[4]}
            disabled={isSubmitting}
            required
          />
        </FormField>

        <FormField label={tFields('apartmentLabel')} error={errors.apartment?.message}>
          <Input
            {...register('apartment')}
            placeholder={tFields('apartmentPlaceholder')}
            disabled={isSubmitting}
            error={errors.apartment?.message}
          />
        </FormField>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <FormField label={tFields('cityLabel')} required error={errors.city?.message}>
            <Input
              {...register('city')}
              placeholder={tFields('cityPlaceholder')}
              disabled={isSubmitting}
              error={errors.city?.message}
            />
          </FormField>

          <FormField label={tFields('stateLabel')} required error={errors.state?.message}>
            <Input
              {...register('state')}
              maxLength={2}
              placeholder={tFields('statePlaceholder')}
              disabled={isSubmitting}
              error={errors.state?.message}
            />
          </FormField>

          <FormField label={tFields('zipCodeLabel')} required error={errors.zipCode?.message}>
            <Input
              {...register('zipCode')}
              placeholder={tFields('zipCodePlaceholder')}
              maxLength={10}
              disabled={isSubmitting}
              error={errors.zipCode?.message}
            />
          </FormField>
        </div>
          </>
        )}
      </ProAccordion>
    </Accordion>
  );
}

