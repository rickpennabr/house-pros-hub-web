'use client';

import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { BusinessFormState } from '../../hooks/useAddBusinessForm';
import { LinkItem } from '@/components/proscard/ProLinks';

interface BusinessStep4Props {
  formState: BusinessFormState;
  updateLink: (type: LinkItem['type'], url?: string, value?: string) => void;
}

const linkTypes: LinkItem['type'][] = [
  'website',
  'instagram',
  'facebook',
  'phone',
  'email',
  'calendar',
];

const linkLabels: Record<LinkItem['type'], string> = {
  website: 'Website',
  instagram: 'Instagram',
  facebook: 'Facebook',
  phone: 'Phone',
  email: 'Email',
  calendar: 'Schedule/Calendar',
  location: 'Location',
};

export function BusinessStep4({ formState, updateLink }: BusinessStep4Props) {
  const getLinkValue = (type: LinkItem['type']): string => {
    const link = formState.links.find(l => l.type === type);
    return link?.url || link?.value || '';
  };

  const handleLinkChange = (type: LinkItem['type'], value: string) => {
    if (type === 'phone' || type === 'email') {
      updateLink(type, undefined, value);
    } else {
      updateLink(type, value, undefined);
    }
  };

  return (
    <div className="space-y-6 flex-1">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Web Presence Links
        </label>
        <span className="text-xs text-gray-500">
          Add links for your business card
        </span>
      </div>

      {linkTypes.map((type) => (
        <FormField key={type} label={linkLabels[type]}>
          <Input
            id={`link-${type}`}
            type={type === 'email' ? 'email' : 'text'}
            value={getLinkValue(type)}
            onChange={(e) => handleLinkChange(type, e.target.value)}
            onClear={() => updateLink(type)}
            showClear
            placeholder={
              type === 'website' || type === 'instagram' || type === 'facebook'
                ? 'https://...'
                : type === 'phone'
                ? 'Phone number'
                : type === 'email'
                ? 'Email address'
                : 'URL or value'
            }
            disabled={formState.isLoading}
          />
        </FormField>
      ))}
    </div>
  );
}

