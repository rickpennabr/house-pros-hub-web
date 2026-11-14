import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hubPersonName,
  mailingFromHub,
  parseHubContact,
  phoneForCrm,
  publicHubContact,
  type HubContact,
} from '@/lib/crm/hub-customer-copy';

function contact(overrides: Partial<HubContact> = {}): HubContact {
  return {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'ana@example.com',
    firstName: 'Ana',
    lastName: 'Silva',
    phone: '7025550100',
    streetAddress: '10 Main St',
    apartment: 'Apt 2',
    city: 'Las Vegas',
    state: 'NV',
    zipCode: '89101',
    places: [],
    ...overrides,
  };
}

describe('hub customer copy', () => {
  it('uses the account address and links a place on the same street', () => {
    const mailing = mailingFromHub(
      contact({
        places: [
          {
            id: 'place-1',
            kind: 'house',
            name: 'Home',
            street: '10 Main St',
            city: 'Las Vegas',
            state: 'NV',
            zipCode: '89101',
          },
          {
            id: 'place-2',
            kind: 'business',
            name: 'Shop',
            street: '99 Other Rd',
            city: 'Henderson',
            state: 'NV',
            zipCode: '89012',
          },
        ],
      })
    );
    assert.equal(mailing.streetAddress, '10 Main St');
    assert.equal(mailing.placeId, 'place-1');
    assert.equal(mailing.portalKind, 'house');
  });

  it('does not attach a place on a different street', () => {
    const mailing = mailingFromHub(
      contact({
        places: [
          {
            id: 'place-2',
            kind: 'house',
            name: 'Other',
            street: '99 Other Rd',
            city: 'Henderson',
            state: 'NV',
            zipCode: '89012',
          },
        ],
      })
    );
    assert.equal(mailing.placeId, null);
    assert.equal(mailing.streetAddress, '10 Main St');
  });

  it('uses a saved place when the account has no street', () => {
    const mailing = mailingFromHub(
      contact({
        streetAddress: null,
        apartment: null,
        city: null,
        state: null,
        zipCode: null,
        places: [
          {
            id: 'place-9',
            kind: 'building',
            name: 'Tower',
            street: '500 Desert Inn',
            city: 'Las Vegas',
            state: 'NV',
            zipCode: '89109',
          },
        ],
      })
    );
    assert.equal(mailing.streetAddress, '500 Desert Inn');
    assert.equal(mailing.placeId, 'place-9');
    assert.equal(mailing.apartment, null);
  });

  it('fills a missing last name and formats a US phone', () => {
    const named = hubPersonName(contact({ lastName: '  ' }));
    assert.deepEqual(named, { firstName: 'Ana', lastName: 'Customer' });
    assert.equal(phoneForCrm('+1 (702) 555-0100'), '(702) 555-0100');
  });

  it('hides the account id from the copy a pro sees', () => {
    const copy = publicHubContact(contact());
    assert.equal('userId' in copy, false);
    assert.equal(copy.firstName, 'Ana');
    assert.equal(copy.phone, '(702) 555-0100');
    assert.equal(copy.streetAddress, '10 Main St');
  });

  it('parses a lookup payload and treats null as no match', () => {
    assert.equal(parseHubContact(null), null);
    const parsed = parseHubContact({
      user_id: '11111111-1111-4111-8111-111111111111',
      email: 'ana@example.com',
      first_name: 'Ana',
      last_name: 'Silva',
      phone: '7025550100',
      street_address: '10 Main St',
      apartment: null,
      city: 'Las Vegas',
      state: 'NV',
      zip_code: '89101',
      places: [],
    });
    assert.equal(parsed?.userId, '11111111-1111-4111-8111-111111111111');
    assert.equal(parsed?.places.length, 0);
  });
});
