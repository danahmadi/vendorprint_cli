# Changelog

## 0.4.0 — prepared for release

- Recognize Read AI's documented domain-verification TXT marker.
- Check Gong's documented `email-tracking` hostname in balanced and full scans.
- Recognize the exact Gong Engage CDN alias corroborated by Figma's public DNS
  and Gong's own documented endpoint chain, at medium confidence.
- Refine existing Gong Engage, Fireflies, and Reachdesk signatures with sources,
  narrower product scopes, and explicit limits on what the records establish.
- Reject empty Fireflies, Read AI, and Reachdesk verification values; remove
  duplicate legacy Reachdesk rules that bypassed validation.
- Describe TXT evidence as a published record, rather than a completed challenge.
- Include research covering 35 Gong, 32 Fireflies, and 30 Granola public references.
  No reliable Granola-specific DNS signature was established.

The changed Gong Engage, Fireflies, and Reachdesk scopes affect fingerprints and
diff keys on upgrade. Treat those one-time interpretation changes separately from
changes to a company's DNS. New Read AI and newly discovered tracking findings
can also change fingerprints. See the research report for evidence and limitations.
