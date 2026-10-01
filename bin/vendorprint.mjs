#!/usr/bin/env node

import { createWriteStream } from "node:fs";
import { once } from "node:events";
import {
  appendFile,
  open,
  readFile,
  truncate,
  writeFile,
} from "node:fs/promises";
import process from "node:process";
import { normalizeDomainInput } from "../src/domain.mjs";
import { auditScanDocuments, parseScanDocuments } from "../src/audit.mjs";
import { discoverCertificateHosts } from "../src/certificate-transparency.mjs";
import { diffTechnologyReports } from "../src/fingerprint.mjs";
import { publicSignatureCatalog } from "../src/signature-registry.mjs";
import {
  compactEvent,
  compactReport,
  parseNdjsonCheckpoint,
} from "../src/output.mjs";
import { scanDomainEvents, scanDomains } from "../src/scanner.mjs";

const HELP = `vendorprint — inspect public DNS for company technology signals

Usage:
  vendorprint acme.com example.com
  vendorprint acme.com --full --pretty
  vendorprint --input accounts.txt --output findings.json
  vendorprint --input accounts.txt --format ndjson --output findings.ndjson
  vendorprint --input accounts.txt --resume findings.ndjson
  vendorprint signatures
  vendorprint signatures audit findings.ndjson
  vendorprint diff before.json after.json

Options:
  --input <path>          Read newline- or comma-separated domains
  --stdin                 Read newline- or comma-separated domains from stdin
  --labels <a,b,c>        Add candidate tracking subdomain labels
  --mode <value>          full (default), balanced, or fast
  --timeout <ms>          DNS timeout per attempt (default: 1800)
  --dns-transport <kind>  native (default) or https (Google DNS-over-HTTPS)
  --concurrency <n>       Domains scanned concurrently (default: 4, maximum: 12)
  --max-inflight-dns <n>  Global DNS attempt ceiling (default: 32, maximum: 128)
  --qps <n>               Maximum DNS attempt starts per second (default: 100)
  --preserve-hostname     Scan the supplied hostname instead of its base domain
  --include-unclassified  Include generic verification-like TXT diagnostics
  --ct                    Add opt-in passive certificate-transparency labels
  --ct-cache <path>       Reuse and update a local CT response cache
  --ct-delay <ms>         Delay between CT index requests (default: 1000)
  --ct-max-hosts <n>      Maximum CT-derived labels per domain (default: 20)
  --full                  Include raw DNS, search, and query diagnostics
  --findings-only         Legacy alias for the default result-first output
  --format <value>        json (default) or ndjson
  --output <path>         Write to a new file instead of stdout
  --resume <path>         Resume and append to an existing NDJSON checkpoint
  --pretty                Force formatted JSON; scans are formatted by default
  --help                  Show this help

Result-first output is the default and includes only observed technologies,
confidence, evidence, and caveats. Use --full for forensic scan detail. Full
scan mode is still the accuracy-first default; --mode changes scan depth, while
--full changes output detail. NDJSON writes one completed domain per line, so
interrupted large scans can resume without repeating completed domains.

Exit codes:
  0  Scan completed (individual domains may still contain DNS errors)
  1  Invalid CLI input
`;

function fail(message) {
  process.stderr.write(`${message}\n\n${HELP}`);
  process.exitCode = 1;
}

function takeValue(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    domains: [],
    extraLabels: [],
    timeoutMs: 1800,
    dnsTransport: "native",
    concurrency: 4,
    maxInflightDns: 32,
    qps: 100,
    pretty: false,
    findingsOnly: false,
    fullOutput: false,
    input: null,
    stdin: false,
    mode: "full",
    format: "json",
    formatSpecified: false,
    output: null,
    resume: null,
    preserveHostname: false,
    includeUnclassifiedVerifications: false,
    certificateTransparencyEnabled: false,
    ctCache: null,
    ctDelayMs: 1000,
    ctMaxHosts: 20,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") return { help: true };
    if (arg === "--pretty") {
      options.pretty = true;
    } else if (arg === "--full") {
      options.fullOutput = true;
    } else if (arg === "--findings-only") {
      options.findingsOnly = true;
    } else if (arg === "--stdin") {
      options.stdin = true;
    } else if (arg === "--preserve-hostname") {
      options.preserveHostname = true;
    } else if (arg === "--include-unclassified") {
      options.includeUnclassifiedVerifications = true;
    } else if (arg === "--ct") {
      options.certificateTransparencyEnabled = true;
    } else if (arg === "--ct-cache") {
      options.ctCache = takeValue(argv, index, "--ct-cache");
      index += 1;
    } else if (arg === "--ct-delay") {
      options.ctDelayMs = Number(takeValue(argv, index, "--ct-delay"));
      index += 1;
    } else if (arg === "--ct-max-hosts") {
      options.ctMaxHosts = Number(takeValue(argv, index, "--ct-max-hosts"));
      index += 1;
    } else if (arg === "--input") {
      options.input = takeValue(argv, index, "--input");
      index += 1;
    } else if (arg === "--output") {
      options.output = takeValue(argv, index, "--output");
      index += 1;
    } else if (arg === "--resume") {
      options.resume = takeValue(argv, index, "--resume");
      index += 1;
    } else if (arg === "--labels") {
      options.extraLabels.push(
        ...takeValue(argv, index, "--labels")
          .split(",")
          .map((item) => item.trim()),
      );
      index += 1;
    } else if (arg === "--mode") {
      options.mode = takeValue(argv, index, "--mode").toLowerCase();
      index += 1;
    } else if (arg === "--format") {
      options.format = takeValue(argv, index, "--format").toLowerCase();
      options.formatSpecified = true;
      index += 1;
    } else if (arg === "--timeout") {
      options.timeoutMs = Number(takeValue(argv, index, "--timeout"));
      index += 1;
    } else if (arg === "--dns-transport") {
      options.dnsTransport = takeValue(argv, index, "--dns-transport").toLowerCase();
      index += 1;
    } else if (arg === "--concurrency") {
      options.concurrency = Number(takeValue(argv, index, "--concurrency"));
      index += 1;
    } else if (arg === "--max-inflight-dns") {
      options.maxInflightDns = Number(
        takeValue(argv, index, "--max-inflight-dns"),
      );
      index += 1;
    } else if (arg === "--qps") {
      options.qps = Number(takeValue(argv, index, "--qps"));
      index += 1;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options.domains.push(arg);
    }
  }

  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100) {
    throw new Error("--timeout must be an integer of at least 100ms");
  }
  if (!["native", "https"].includes(options.dnsTransport)) {
    throw new Error("--dns-transport must be native or https");
  }
  if (
    !Number.isInteger(options.concurrency) ||
    options.concurrency < 1 ||
    options.concurrency > 12
  ) {
    throw new Error("--concurrency must be an integer between 1 and 12");
  }
  if (
    !Number.isInteger(options.maxInflightDns) ||
    options.maxInflightDns < 1 ||
    options.maxInflightDns > 128
  ) {
    throw new Error("--max-inflight-dns must be an integer between 1 and 128");
  }
  if (!Number.isInteger(options.qps) || options.qps < 1 || options.qps > 500) {
    throw new Error("--qps must be an integer between 1 and 500");
  }
  if (!Number.isInteger(options.ctDelayMs) || options.ctDelayMs < 500) {
    throw new Error("--ct-delay must be an integer of at least 500ms");
  }
  if (
    !Number.isInteger(options.ctMaxHosts) ||
    options.ctMaxHosts < 1 ||
    options.ctMaxHosts > 100
  ) {
    throw new Error("--ct-max-hosts must be an integer between 1 and 100");
  }
  if (!["fast", "balanced", "full"].includes(options.mode)) {
    throw new Error("--mode must be full, balanced, or fast");
  }
  if (!["json", "ndjson"].includes(options.format)) {
    throw new Error("--format must be json or ndjson");
  }
  if (options.fullOutput && options.findingsOnly) {
    throw new Error("--full cannot be combined with --findings-only");
  }
  if (options.resume) {
    if (options.output) {
      throw new Error("--resume cannot be combined with --output");
    }
    if (options.formatSpecified && options.format !== "ndjson") {
      throw new Error("--resume requires --format ndjson");
    }
    options.format = "ndjson";
  }
  if (options.format === "ndjson" && options.pretty) {
    throw new Error("--pretty cannot be combined with NDJSON");
  }
  return options;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function addCertificateTransparencyLabels(options) {
  if (!options.certificateTransparencyEnabled) return;
  const normalized = [
    ...new Set(
      options.domains.flatMap((input) => {
        try {
          return [
            normalizeDomainInput(input, {
              preserveHostname: options.preserveHostname,
            }),
          ];
        } catch {
          return [];
        }
      }),
    ),
  ];
  if (options.resume) {
    const checkpoint = parseNdjsonCheckpoint(
      await readFile(options.resume, "utf8"),
    );
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      if (checkpoint.completedDomains.has(normalized[index])) {
        normalized.splice(index, 1);
      }
    }
  }
  if (normalized.length > 100) {
    throw new Error(
      "--ct is capped at 100 domains per run to protect the public index. Use cached batches for larger datasets.",
    );
  }
  let cache = {};
  if (options.ctCache) {
    try {
      cache = JSON.parse(await readFile(options.ctCache, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const passiveLabelsByDomain = {};
  const errors = [];
  let requests = 0;
  for (const domain of normalized) {
    let entry = cache[domain];
    if (!entry) {
      if (requests > 0) await wait(options.ctDelayMs);
      try {
        entry = await discoverCertificateHosts(domain, {
          maxHosts: options.ctMaxHosts,
        });
        cache[domain] = entry;
      } catch (error) {
        errors.push({
          domain,
          error: error instanceof Error ? error.message : String(error),
        });
        entry = { hosts: [] };
      }
      requests += 1;
    }
    passiveLabelsByDomain[domain] = (entry.hosts ?? [])
      .map((host) => host.slice(0, -(domain.length + 1)))
      .filter((label) => /^[a-z0-9-]{1,63}$/.test(label));
  }
  if (options.ctCache) {
    await writeFile(options.ctCache, `${JSON.stringify(cache, null, 2)}\n`);
  }
  options.passiveLabelsByDomain = passiveLabelsByDomain;
  options.certificateTransparency = {
    enabled: true,
    thirdPartyIndex: "crt.sh",
    requests,
    cached: normalized.length - requests,
    errors,
  };
  process.stderr.write(
    `CT discovery: ${requests} index requests, ${normalized.length - requests} cache hits, ${errors.length} errors.\n`,
  );
}

async function runUtilityCommand(argv) {
  const pretty = argv.includes("--pretty");
  const args = argv.filter((arg) => arg !== "--pretty");
  if (args[0] === "signatures" && args.length === 1) {
    process.stdout.write(
      `${JSON.stringify(publicSignatureCatalog(), null, pretty ? 2 : 0)}\n`,
    );
    return true;
  }
  if (
    (args[0] === "audit" && args[1]) ||
    (args[0] === "signatures" && args[1] === "audit" && args[2])
  ) {
    const path = args[0] === "audit" ? args[1] : args[2];
    const documents = parseScanDocuments(await readFile(path, "utf8"));
    process.stdout.write(
      `${JSON.stringify(auditScanDocuments(documents), null, pretty ? 2 : 0)}\n`,
    );
    return true;
  }
  if (args[0] === "diff" && args[1] && args[2]) {
    const before = JSON.parse(await readFile(args[1], "utf8"));
    const after = JSON.parse(await readFile(args[2], "utf8"));
    process.stdout.write(
      `${JSON.stringify(
        diffTechnologyReports(before, after),
        null,
        pretty ? 2 : 0,
      )}\n`,
    );
    return true;
  }
  return false;
}

function splitDomains(value) {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readStdin() {
  let value = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) value += chunk;
  return value;
}

function filterCompletedInputs(inputs, completedDomains, options) {
  return inputs.filter((input) => {
    try {
      const normalized = normalizeDomainInput(input, {
        preserveHostname: options.preserveHostname,
      });
      return !completedDomains.has(normalized);
    } catch {
      return true;
    }
  });
}

async function reserveNewFile(path) {
  const handle = await open(path, "wx");
  await handle.close();
}

async function writeLine(stream, value) {
  if (!stream.write(`${JSON.stringify(value)}\n`)) {
    await once(stream, "drain");
  }
}

async function closeStream(stream) {
  stream.end();
  await once(stream, "close");
}

async function runNdjson(options) {
  let checkpoint = {
    completedDomains: new Set(),
    resultEvents: 0,
    hasSummary: false,
    trailingPartial: false,
  };
  let outputPath = options.output;
  if (options.resume) {
    outputPath = options.resume;
    const checkpointValue = await readFile(options.resume, "utf8");
    checkpoint = parseNdjsonCheckpoint(checkpointValue);
    if (checkpoint.trailingPartial) {
      const lastNewline = checkpointValue.lastIndexOf("\n");
      const validPrefix = checkpointValue.slice(0, lastNewline + 1);
      await truncate(options.resume, Buffer.byteLength(validPrefix));
    } else if (checkpointValue && !checkpointValue.endsWith("\n")) {
      await appendFile(options.resume, "\n");
    }
    options.domains = filterCompletedInputs(
      options.domains,
      checkpoint.completedDomains,
      options,
    );
    if (options.domains.length === 0) {
      process.stderr.write(
        `No pending domains; ${checkpoint.completedDomains.size} already completed in ${options.resume}.\n`,
      );
      return;
    }
  } else if (outputPath) {
    await reserveNewFile(outputPath);
  }

  const stream = outputPath
    ? createWriteStream(outputPath, { flags: "a", encoding: "utf8" })
    : process.stdout;
  for await (const rawEvent of scanDomainEvents(options.domains, options)) {
    let event = options.fullOutput ? rawEvent : compactEvent(rawEvent);
    if (event.type === "meta" && options.resume) {
      event = {
        ...event,
        resume: {
          checkpoint: options.resume,
          previouslyCompleted: checkpoint.completedDomains.size,
          remainingRequested: options.domains.length,
        },
      };
    }
    await writeLine(stream, event);
  }
  if (outputPath) {
    await closeStream(stream);
    process.stderr.write(`Wrote resumable NDJSON to ${outputPath}.\n`);
  }
}

try {
  const argv = process.argv.slice(2);
  if (await runUtilityCommand(argv)) {
    // Utility commands do not perform network operations.
  } else {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(HELP);
  } else {
    if (options.input) {
      options.domains.push(
        ...splitDomains(await readFile(options.input, "utf8")),
      );
    }
    if (options.stdin) {
      options.domains.push(...splitDomains(await readStdin()));
    }
    await addCertificateTransparencyLabels(options);
    if (options.domains.length === 0) {
      fail("Provide at least one domain, --input, or --stdin.");
    } else if (options.format === "ndjson") {
      await runNdjson(options);
    } else {
      const report = await scanDomains(options.domains, options);
      const output = options.fullOutput ? report : compactReport(report);
      const serialized = `${JSON.stringify(
        output,
        null,
        2,
      )}\n`;
      if (options.output) {
        await writeFile(options.output, serialized, { flag: "wx" });
        process.stderr.write(`Wrote JSON to ${options.output}.\n`);
      } else {
        process.stdout.write(serialized);
      }
    }
  }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
