# Contributing

Contributions are welcome. Open an issue before a large change so the approach can
be discussed, and keep pull requests focused on one signal family or behavior.

## Development

Use Node.js 20 or newer.

```bash
npm test
npm run check
node bin/vendorprint.mjs --help
```

Provider detectors should be evidence-driven and include:

- a stable public DNS pattern, preferably documented by the provider;
- the narrowest defensible product scope;
- a confidence level and caveat;
- unit tests for positive matches and nearby false positives.

An observed but undocumented vendor target may be included at medium confidence when
there is repeatable corroboration. Document why it is not high confidence. Generic
verification-shaped TXT records must remain in the opt-in unclassified diagnostic
channel rather than becoming named vendor findings.

Do not add endpoint probing, zone transfers, unbounded subdomain enumeration, or
private customer datasets.
