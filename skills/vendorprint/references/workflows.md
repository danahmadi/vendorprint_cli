# Batch and library workflows

These examples use the published `vendorprint@0.5.0` interface.

## Stream and resume a batch

Use a new output filename. VendorPrint refuses to overwrite existing output.

```bash
npx --yes vendorprint@0.5.0 --input domains.txt --format ndjson --output findings.ndjson
```

NDJSON contains a `meta` event, `result` events with a compact `finding` field,
and a final `summary` event. Do not treat every line as a domain result. Read
each result's completeness; an interrupted stream may have no final summary.

Resume with the same original input file and checkpoint:

```bash
npx --yes vendorprint@0.5.0 --input domains.txt --resume findings.ndjson
```

Resume skips completed domains, tolerates a final partial line, and appends to the
checkpoint. A domain that completed with partial DNS coverage is still considered
completed for resume; resuming does not automatically rescan it.

Use a separate scan and new output file if a domain needs to be rechecked. If
comparing reports, account for observation time, scanner/catalog version,
transport, and scan depth before interpreting changes.

## Use the library in an application

For a user-requested integration, install `vendorprint@0.5.0` with the project's
package manager. The library returns full reports in `results`; call
`compactReport` for the same `findings` shape as the default CLI:

```js
import { scanDomains, compactReport } from "vendorprint";

const report = await scanDomains(["example.com"]);
const findings = compactReport(report);
console.log(JSON.stringify(findings, null, 2));
```

For completion-order streaming:

```js
import { scanDomainEvents, compactEvent } from "vendorprint";

for await (const event of scanDomainEvents(["example.com"])) {
  console.log(JSON.stringify(compactEvent(event)));
}
```

Use domain inputs from the requested workflow, and preserve evidence and
completeness in any mapping to another application's schema. VendorPrint's
confidence labels should not silently become a different system's numeric
confidence score.

## Exact hostnames

Normal company research groups inputs by base domain while retaining supplied
hostnames for evidence checks. Use `--preserve-hostname` only when the request is
about that exact hostname. For known branded tracking hosts, the CLI also accepts
`--hostname-hints` as a JSON map from company domains to hostname arrays; see
the [input documentation](https://www.vendorprintcli.com/docs#inputs).
