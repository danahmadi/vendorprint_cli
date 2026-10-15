import test from 'node:test';
import assert from 'node:assert/strict';
import { Resolver } from 'node:dns/promises';
import { FAST_TRACKING_LABELS, BALANCED_TRACKING_LABELS, DEFAULT_TRACKING_LABELS, detectCnameTechnology } from '../src/signals.mjs';
import { buildTechnologyProfile } from '../src/profile.mjs';
import { followCnameChain, scanDomains } from '../src/scanner.mjs';

const rules = [
  ['Vanta', 'cname.vantatrust.com', 'vanta_trust_center'],
  ['SafeBase', 'portals.safebase.io', 'safebase_trust_center'],
];

test('Drata matches only its exact trust endpoint, separately from SafeBase hosting', () => {
  const signal = detectCnameTechnology('trust.example.com', 'TRUST.CNAME.DRATA.COM.');
  assert.equal(signal?.provider, 'Drata');
  assert.equal(signal.productScope, 'drata_trust_center');
  for (const target of ['tenant.trust.cname.drata.com', 'trust.cname.drata.com.attacker.test', 'other.drata.com']) {
    assert.equal(detectCnameTechnology('trust.example.com', target), null);
  }
  assert.equal(detectCnameTechnology('trust.drata.com', 'drata.portals.safebase.io').provider, 'SafeBase');
});

test('trust-center signatures require vendor targets and preserve narrow security scopes', () => {
  for (const [provider, suffix, scope] of rules) {
    const signal = detectCnameTechnology('security.example.com', `TENANT.${suffix.toUpperCase()}.`);
    assert.equal(signal?.provider, provider);
    assert.equal(signal.confidence, 'high');
    for (const target of [`tenant.${suffix}.attacker.test`, `not${suffix}`, 'proxy.example.net']) {
      assert.equal(detectCnameTechnology('trust.example.com', target), null);
    }
    const profile = buildTechnologyProfile({ domainVerifications: [], authorizedEmailSenders: [], cnameServices: [{ provider, category: signal.category, evidence: [signal] }] });
    const finding = profile.securityAndCompliance.find(x => x.provider === provider);
    assert.equal(finding.productScope, scope);
    assert.match(finding.caveat, /does not establish certification/);
    assert.equal(finding.relationshipLevel, 'platform_configuration');
    assert.ok(finding.evidence[0].sources.length >= 2);
  }
  for (const target of ['unrelated.vanta.com', 'unrelated.vantatrust.com', 'app.safebase.io', 'tenant.cloudfront.net', 'cname.vercel-dns.com']) {
    assert.ok(!['Vanta', 'SafeBase'].includes(detectCnameTechnology('trust.example.com', target)?.provider));
  }
});

test('trust is prioritized in every mode, with security and trustcenter in balanced/full', () => {
  for (const labels of [FAST_TRACKING_LABELS, BALANCED_TRACKING_LABELS, DEFAULT_TRACKING_LABELS]) {
    assert.ok(labels.indexOf('trust') >= 0 && labels.indexOf('trust') < 5);
    assert.equal(new Set(labels).size, labels.length);
  }
  for (const labels of [BALANCED_TRACKING_LABELS, DEFAULT_TRACKING_LABELS]) {
    assert.ok(labels.includes('security'));
    assert.ok(labels.includes('trustcenter'));
  }
});

test('a short first-party alias chain can reveal trust-center hosting', async () => {
  const paths = await followCnameChain('trust.example.com', ['security.example.com'], async host => ({
    value: host === 'security.example.com' ? ['example.portals.safebase.io'] : [], error: null,
  }));
  assert.ok(paths.flat().some(target => detectCnameTechnology('trust.example.com', target)?.provider === 'SafeBase'));
});

test('every scan mode queries trust and reports the provider within the hard budget', async t => {
  t.mock.method(Resolver.prototype, 'resolveMx', async () => []);
  t.mock.method(Resolver.prototype, 'resolveTxt', async () => []);
  t.mock.method(Resolver.prototype, 'resolveNs', async () => []);
  const queried = new Set();
  t.mock.method(Resolver.prototype, 'resolveCname', async hostname => {
    queried.add(hostname);
    if (hostname === 'trust.example.com') return ['example.portals.safebase.io'];
    if (hostname === 'security.example.com') return ['tenant.cname.vantatrust.com'];
    return [];
  });
  for (const mode of ['fast', 'balanced', 'full']) {
    queried.clear();
    const { results: [r] } = await scanDomains(['example.com'], { mode });
    assert.ok(queried.has('trust.example.com'));
    assert.ok(r.technologyProfile.securityAndCompliance.some(x => x.provider === 'SafeBase'));
    if (mode !== 'fast') {
      assert.ok(queried.has('security.example.com'));
      assert.ok(queried.has('trustcenter.example.com'));
      assert.ok(r.technologyProfile.securityAndCompliance.some(x => x.provider === 'Vanta'));
    }
    assert.ok(r.querySafety.queryAttempts <= 80);
  }
});
