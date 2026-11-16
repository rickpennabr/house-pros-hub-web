import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  googleStartPath,
  isPrivateLanHostname,
  lanHostnameViaNip,
  lanHostnameViaSslip,
  oauthFriendlyCandidates,
  oauthFriendlyOrigin,
} from './googleOAuth';

describe('googleOAuth LAN helpers', () => {
  it('treats private IPv4 as LAN and leaves localhost alone', () => {
    assert.equal(isPrivateLanHostname('192.168.0.25'), true);
    assert.equal(isPrivateLanHostname('10.0.0.8'), true);
    assert.equal(isPrivateLanHostname('172.16.4.2'), true);
    assert.equal(isPrivateLanHostname('localhost'), false);
    assert.equal(isPrivateLanHostname('127.0.0.1'), false);
    assert.equal(isPrivateLanHostname('houseproshub.com'), false);
  });

  it('maps a LAN IP to sslip.io so Supabase can allowlist a hostname', () => {
    assert.equal(lanHostnameViaSslip('192.168.0.25'), '192-168-0-25.sslip.io');
    assert.equal(lanHostnameViaNip('192.168.0.25'), '192.168.0.25.nip.io');
    const friendly = oauthFriendlyOrigin({
      protocol: 'http:',
      hostname: '192.168.0.25',
      port: '3000',
    });
    assert.equal(friendly.switchedFromIp, true);
    assert.equal(friendly.origin, 'http://192-168-0-25.sslip.io:3000');
    assert.deepEqual(oauthFriendlyCandidates({ protocol: 'http:', hostname: '192.168.0.25', port: '3000' }), [
      'http://192-168-0-25.sslip.io:3000',
      'http://192.168.0.25.nip.io:3000',
    ]);
  });

  it('builds the quiet google-start hop path like BrazaLink', () => {
    assert.equal(
      googleStartPath('en', 'signin', '/en/businesslist'),
      '/en/auth/google-start?flow=signin&returnUrl=%2Fen%2Fbusinesslist'
    );
    assert.equal(googleStartPath('es', 'customer'), '/es/auth/google-start?flow=customer');
  });
});
