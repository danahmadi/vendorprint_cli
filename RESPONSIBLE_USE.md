# Responsible use

vendorprint is designed for careful, low-impact analysis of public DNS records.

## What it does

- Queries public DNS through the machine's configured recursive resolver.
- Checks a bounded set of standard records and candidate hostnames.
- Limits per-domain and global concurrency, total query attempts, and global query
  start rate.
- Retries only four critical record types and reserves those retries inside the
  per-domain budget.
- Follows SPF and positive CNAME evidence only within explicit depth and query
  limits.
- Redacts verification tokens while retaining the provider identity needed for
  evidence.
- Reports confidence and caveats instead of treating absence as proof.

## What it does not do

- It does not send HTTP requests to company websites or vendor tracking endpoints.
- It does not attempt DNS zone transfers.
- It does not use NSEC walking or arbitrary subdomain enumeration.
- It does not brute-force arbitrary subdomains.
- It does not bypass authentication, access controls, or rate limits.
- It does not prove that a subscription is paid, active, or assigned to employees.

## Operating guidance

The default full scan prioritizes accuracy. Use `balanced` or `fast` only when you
have consciously accepted lower coverage. Keep the default global DNS limits unless
you operate the recursive resolver and know it can support a different rate. For
large lists, use NDJSON checkpoints and `--resume` so an interruption does not cause
completed domains to be queried again. Coordinate with your DNS resolver operator
before running unusually large jobs.

Passive certificate-transparency discovery is opt-in because it queries a
third-party index. Use `--ct-cache`, keep batches small, and respect the index
operator's terms and capacity. Certificate-derived names are treated only as
candidates and must be corroborated by live DNS. The feature never requests the
company's website or tracking endpoints.

DNS records can be stale, shared, proxied, or intentionally hidden. Preserve the
underlying evidence, distinguish strong vendor-attributable records from weak
relationships, and never convert an inconclusive negative into "not using."

Only process domains you are permitted to research. Follow applicable law, provider
terms, organizational data-governance rules, and retention policies. vendorprint
produces research signals; a human or downstream policy should decide whether they
are suitable for operational use.
