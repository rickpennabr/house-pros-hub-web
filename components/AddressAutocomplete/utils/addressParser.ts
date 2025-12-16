import { AddressData } from '../../AddressAutocomplete';

export interface PhotonResult {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    postcode?: string;
    zipcode?: string;
    country?: string;
    [key: string]: any;
  };
  geometry: {
    coordinates: [number, number];
  };
}

export function formatAddress(result: PhotonResult): string {
  const props = result.properties;
  const parts: string[] = [];

  if (props.housenumber) parts.push(props.housenumber);
  if (props.street) parts.push(props.street);
  if (props.city) parts.push(props.city);
  if (props.state) parts.push(props.state);
  if (props.postcode) parts.push(props.postcode);

  return parts.join(', ') || props.name || '';
}

export function parseAddressData(result: PhotonResult): AddressData {
  const props = result.properties;

  let streetAddress = '';
  if (props.housenumber && props.street) {
    streetAddress = `${props.housenumber} ${props.street}`.trim();
  } else if (props.street) {
    streetAddress = props.street;
  } else if (props.name) {
    if (props.name !== props.city && !props.name.includes(',')) {
      streetAddress = props.name;
    }
  }

  const city = props.city || props.name || '';

  let state = props.state || 'NV';
  if (state === 'Nevada') {
    state = 'NV';
  }

  const zipCode = props.postcode || props.zipcode || '';

  return {
    streetAddress: streetAddress || props.name || '',
    city: city,
    state: state,
    zipCode: zipCode,
    apartment: '',
    fullAddress: formatAddress(result),
  };
}

