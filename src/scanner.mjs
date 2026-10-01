import { Resolver } from "node:dns/promises";
import { createDohResolver } from "./doh-resolver.mjs";
import { createHash } from "node:crypto";
import { normalizeDomainInput } from "./domain.mjs";
import {
  BALANCED_TRACKING_LABELS,
  DEFAULT_TRACKING_LABELS,
  FAST_TRACKING_LABELS,
  classifyDnsProvider,
  classifyDelegatedNameservers,
  classifyDkimTarget,
  classifyMx,
  dedupeVendorSignals,
  detectCnameTechnology,
  detectSalesVendor,
  extractDomainVerifications,
  parseDmarc,
  parseSpf,
} from "./signals.mjs";
import { buildTechnologyProfile } from "./profile.mjs";
import { SIGNATURE_CATALOG_VERSION } from "./signature-registry.mjs";
import { fingerprintTechnologyProfile } from "./fingerprint.mjs";

const DKIM_SELECTORS = ["google", "selector1", "selector2", "default"];
const DELEGATED_SUBDOMAINS = ["email", "mail", "news", "send", "marketing"];
const ADAPTIVE_DKIM_SELECTORS = {
  HubSpot: ["hs1", "hs2"],
  Mailchimp: ["k2", "k3"],
  SendGrid: ["s1", "s2"],
  Salesforce: ["salesforce1", "salesforce2"],
};
const ABSENCE_CODES = new Set(["ENODATA", "ENOTFOUND", "ENONAME", "NXDOMAIN"]);
const MAX_QUERIES_PER_DOMAIN = 80;
const PER_DOMAIN_QUERY_CONCURRENCY = 4;
const QUERY_START_DELAY_MS = 25;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveWithRetry(operation, options = {}) {
  const retries = options.retries ?? 0;
  const schedule = options.schedule ?? ((attempt) => attempt());
  let attempts = 0;

  while (true) {
    attempts += 1;
    try {
      return {
        value: await schedule(operation),
        error: null,
        attempts,
        retryAttempts: attempts - 1,
      };
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : "ERROR";
      if (ABSENCE_CODES.has(code)) {
        return {
          value: [],
          error: null,
          attempts,
          retryAttempts: attempts - 1,
        };
      }
      if (attempts > retries) {
        return {
          value: [],
          error: String(code),
          attempts,
          retryAttempts: attempts - 1,
        };
      }
      await delay(50 * attempts + Math.floor(Math.random() * 50));
    }
  }
}

function createQueryLimiter(concurrency, startDelayMs) {
  let active = 0;
  let nextStartAt = 0;
  let timer = null;
  const queue = [];

  function drain() {
    if (active >= concurrency || queue.length === 0) return;

    const waitMs = Math.max(0, nextStartAt - Date.now());
    if (waitMs > 0) {
      if (timer === null) {
        timer = setTimeout(() => {
          timer = null;
          drain();
        }, waitMs);
      }
      return;
    }

    const item = queue.shift();
    active += 1;
    nextStartAt = Date.now() + startDelayMs;
    Promise.resolve()
      .then(item.operation)
      .then(item.resolve, item.reject)
      .finally(() => {
        active -= 1;
        drain();
      });
    drain();
  }

  return (operation) =>
    new Promise((resolve, reject) => {
      queue.push({ operation, resolve, reject });
      drain();
    });
}

export function collapseWildcardLikeCnames(
  cnameResults,
  labelsChecked,
  wildcardProbeTargets = [],
) {
  const observations = cnameResults.flatMap(({ hostname, value }) =>
    value.map((target) => ({
      hostname,
      target: target.replace(/\.$/, "").toLowerCase(),
    })),
  );
  const targetCounts = new Map();
  for (const observation of observations) {
    targetCounts.set(
      observation.target,
      (targetCounts.get(observation.target) ?? 0) + 1,
    );
  }
  const threshold =
    labelsChecked === 0
      ? Number.POSITIVE_INFINITY
      : Math.min(labelsChecked, Math.max(3, Math.ceil(labelsChecked * 0.6)));
  const wildcardLikeTargets = new Set(
    [...targetCounts.entries()]
      .filter(([, count]) => count >= threshold)
      .map(([target]) => target),
  );
  for (const target of wildcardProbeTargets) {
    wildcardLikeTargets.add(target.replace(/\.$/, "").toLowerCase());
  }
  const retainedWildcardTargets = new Set();
  const evidenceObservations = observations
    .filter((observation) => {
      if (!wildcardLikeTargets.has(observation.target)) return true;
      if (retainedWildcardTargets.has(observation.target)) return false;
      retainedWildcardTargets.add(observation.target);
      return true;
    })
    .map((observation) => ({
      ...observation,
      wildcardLike: wildcardLikeTargets.has(observation.target),
    }));

  return {
    evidenceObservations,
    wildcardLikeTargets: [...wildcardLikeTargets].map((target) => ({
      target,
      matchingCandidateLabels: targetCounts.get(target),
    })),
    observationsCollapsed: observations.length - evidenceObservations.length,
  };
}

export async function resolveSpfGraph(
  initialTxtRecords,
  lookupTxt,
  options = {},
) {
  const maxLookups = options.maxLookups ?? 10;
  const root = parseSpf(initialTxtRecords);
  const queue = [...root.includes, ...root.redirects];
  const visited = new Set();
  const resolved = [];
  const errors = [];
  const senders = new Set(root.authorizedSenders);

  while (queue.length > 0 && visited.size < maxLookups) {
    const host = queue.shift();
    if (!host || visited.has(host)) continue;
    visited.add(host);
    const result = await lookupTxt(host);
    if (result.error) errors.push({ host, error: result.error });
    const parsed = parseSpf(result.value ?? []);
    for (const provider of parsed.authorizedSenders) senders.add(provider);
    resolved.push({
      host,
      includes: parsed.includes,
      redirects: parsed.redirects,
      authorizedSenders: parsed.authorizedSenders,
      error: result.error,
    });
    for (const child of [...parsed.includes, ...parsed.redirects]) {
      if (!visited.has(child)) queue.push(child);
    }
  }

  return {
    ...root,
    authorizedSenders: [...senders],
    resolvedIncludes: resolved,
    lookupCount: visited.size,
    lookupLimit: maxLookups,
    truncated: queue.some((host) => !visited.has(host)),
    lookupErrors: errors,
  };
}

export async function followCnameChain(
  hostname,
  initialTargets,
  lookupCname,
  options = {},
) {
  const maxDepth = options.maxDepth ?? 3;
  const paths = [];
  for (const initialTarget of initialTargets) {
    const path = [
      hostname.replace(/\.$/, "").toLowerCase(),
      initialTarget.replace(/\.$/, "").toLowerCase(),
    ];
    const visited = new Set(path);
    let target = path.at(-1);
    for (let depth = 1; depth < maxDepth; depth += 1) {
      const result = await lookupCname(target);
      const next = result.value?.[0]?.replace(/\.$/, "").toLowerCase();
      if (!next || visited.has(next)) break;
      path.push(next);
      visited.add(next);
      target = next;
    }
    paths.push(path);
  }
  return paths;
}

function buildConfig(options) {
  const config = {
    timeoutMs: options.timeoutMs ?? 1800,
    dnsTransport: options.dnsTransport ?? "native",
    concurrency: options.concurrency ?? 4,
    extraLabels: options.extraLabels ?? [],
    mode: options.mode ?? "full",
    maxInflightDns: options.maxInflightDns ?? 32,
    qps: options.qps ?? 100,
    criticalRetries: options.criticalRetries ?? 1,
    preserveHostname: options.preserveHostname ?? false,
    includeUnclassifiedVerifications:
      options.includeUnclassifiedVerifications ?? false,
    passiveLabelsByDomain: options.passiveLabelsByDomain ?? {},
    certificateTransparency: options.certificateTransparency ?? null,
  };
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 100) {
    throw new RangeError("timeoutMs must be an integer of at least 100");
  }
  if (!["native", "https"].includes(config.dnsTransport)) {
    throw new RangeError("dnsTransport must be native or https");
  }
  if (
    !Number.isInteger(config.concurrency) ||
    config.concurrency < 1 ||
    config.concurrency > 12
  ) {
    throw new RangeError("concurrency must be an integer between 1 and 12");
  }
  if (!["fast", "balanced", "full"].includes(config.mode)) {
    throw new RangeError("mode must be fast, balanced, or full");
  }
  if (!Array.isArray(config.extraLabels)) {
    throw new TypeError("extraLabels must be an array");
  }
  if (
    !Number.isInteger(config.maxInflightDns) ||
    config.maxInflightDns < 1 ||
    config.maxInflightDns > 128
  ) {
    throw new RangeError("maxInflightDns must be an integer between 1 and 128");
  }
  if (!Number.isInteger(config.qps) || config.qps < 1 || config.qps > 500) {
    throw new RangeError("qps must be an integer between 1 and 500");
  }
  if (
    !Number.isInteger(config.criticalRetries) ||
    config.criticalRetries < 0 ||
    config.criticalRetries > 2
  ) {
    throw new RangeError("criticalRetries must be an integer between 0 and 2");
  }
  if (typeof config.preserveHostname !== "boolean") {
    throw new TypeError("preserveHostname must be a boolean");
  }
  if (typeof config.includeUnclassifiedVerifications !== "boolean") {
    throw new TypeError(
      "includeUnclassifiedVerifications must be a boolean",
    );
  }
  if (
    config.passiveLabelsByDomain === null ||
    typeof config.passiveLabelsByDomain !== "object" ||
    Array.isArray(config.passiveLabelsByDomain)
  ) {
    throw new TypeError("passiveLabelsByDomain must be an object");
  }
  return config;
}

function prepareInputs(inputs, config) {
  if (!Array.isArray(inputs)) {
    throw new TypeError("inputs must be an array of domains");
  }
  const invalidInputs = [];
  const domains = [];
  for (const input of inputs) {
    try {
      domains.push(
        normalizeDomainInput(input, {
          preserveHostname: config.preserveHostname,
        }),
      );
    } catch (error) {
      invalidInputs.push({
        input,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    domains: [...new Set(domains)],
    invalidInputs,
  };
}

function buildMethodology(config) {
  return {
    scope:
      config.mode === "full"
        ? "Public MX, TXT ownership/SPF, DMARC, common and evidence-guided DKIM selectors, apex and delegated nameservers, and bounded CNAME discovery with short chain following."
        : "Public MX, TXT ownership/SPF, DMARC, nameservers, and CNAMEs on prioritized tracking subdomain labels. DKIM is omitted in fast and balanced modes.",
    confidence:
      "Findings distinguish domain relationships, sending authorization, and product-specific configuration. Absence of a signal is inconclusive.",
    privacy: `${config.certificateTransparency
      ? "Uses public DNS plus explicitly enabled passive certificate-transparency metadata. Certificate discovery queries a third-party log index, then only DNS-validates names; no company endpoint, login, mailbox, or personal data is accessed."
      : "Uses public DNS records only; no login, mailbox, personal data, or vendor endpoint is accessed."}${config.dnsTransport === "https"
      ? " DNS queries are sent to Google's DNS-over-HTTPS service."
      : ""}`,
    dnsTransport: config.dnsTransport,
    safety: `Queries are bounded to ${MAX_QUERIES_PER_DOMAIN} attempts per domain, including adaptive branches; limited to ${PER_DOMAIN_QUERY_CONCURRENCY} logical queries in flight per domain and ${config.maxInflightDns} DNS attempts globally, with no more than ${config.qps} starts per second. Only four critical record types are retried. No AXFR, NSEC walking, or endpoint probing is performed.`,
    signatureCatalogVersion: SIGNATURE_CATALOG_VERSION,
  };
}

async function scanDomain(domain, options) {
  const startedAt = performance.now();
  const resolver = options.dnsTransport === "https"
    ? createDohResolver({ timeoutMs: options.timeoutMs })
    : new Resolver({ timeout: options.timeoutMs, tries: 1 });
  const baseLabels =
    options.mode === "fast"
      ? FAST_TRACKING_LABELS
      : options.mode === "balanced"
        ? BALANCED_TRACKING_LABELS
        : DEFAULT_TRACKING_LABELS;
  const dkimSelectors = options.mode === "full" ? DKIM_SELECTORS : [];
  const delegatedLabels = options.mode === "full" ? DELEGATED_SUBDOMAINS : [];
  const fixedQueries =
    5 + dkimSelectors.length * 2 + delegatedLabels.length;
  const retryReserve = options.criticalRetries * 4;
  const candidateLabels = [
    ...new Set(
      [
        ...baseLabels,
        ...options.extraLabels,
        ...(options.passiveLabelsByDomain[domain] ?? []),
      ]
        .map((label) => label.trim().toLowerCase())
        .filter((label) => /^[a-z0-9-]{1,63}$/.test(label)),
    ),
  ];
  const labelBudget =
    MAX_QUERIES_PER_DOMAIN - fixedQueries - retryReserve;
  const labels = candidateLabels.slice(0, labelBudget);
  const resolveLimited = createQueryLimiter(
    PER_DOMAIN_QUERY_CONCURRENCY,
    QUERY_START_DELAY_MS,
  );
  let queryAttempts = 0;
  let retryAttempts = 0;
  let budgetExhausted = false;
  const query = (operation, retries = 0) =>
    resolveLimited(async () => {
      const result = await resolveWithRetry(operation, {
        retries,
        schedule: (attempt) =>
          options.scheduleGlobalDnsAttempt(async () => {
            if (queryAttempts >= MAX_QUERIES_PER_DOMAIN) {
              budgetExhausted = true;
              throw Object.assign(new Error("query budget exhausted"), {
                code: "BUDGET_EXHAUSTED",
              });
            }
            queryAttempts += 1;
            return attempt();
          }),
      });
      retryAttempts += result.retryAttempts;
      return result;
    });

  const mxPromise = query(() => resolver.resolveMx(domain), options.criticalRetries);
  const txtPromise = query(
    () => resolver.resolveTxt(domain),
    options.criticalRetries,
  );
  const dmarcPromise = query(
    () => resolver.resolveTxt(`_dmarc.${domain}`),
    options.criticalRetries,
  );
  const nsPromise = query(() => resolver.resolveNs(domain), options.criticalRetries);
  const wildcardHostname = `vp-wildcard-${createHash("sha256")
    .update(domain)
    .digest("hex")
    .slice(0, 10)}.${domain}`;
  const wildcardPromise = query(() => resolver.resolveCname(wildcardHostname));
  const cnamePromises = labels.map(async (label) => {
    const hostname = `${label}.${domain}`;
    const result = await query(() => resolver.resolveCname(hostname));
    return { hostname, ...result };
  });
  const dkimPromises = dkimSelectors.flatMap((selector) => {
    const hostname = `${selector}._domainkey.${domain}`;
    return [
      query(() => resolver.resolveCname(hostname)).then((result) => ({
        selector,
        hostname,
        type: "CNAME",
        ...result,
      })),
      query(() => resolver.resolveTxt(hostname)).then((result) => ({
        selector,
        hostname,
        type: "TXT",
        ...result,
      })),
    ];
  });
  const delegatedNsPromises = delegatedLabels.map((label) => {
    const hostname = `${label}.${domain}`;
    return query(() => resolver.resolveNs(hostname)).then((result) => ({
      hostname,
      ...result,
    }));
  });

  const [
    mxResult,
    txtResult,
    dmarcResult,
    nsResult,
    wildcardResult,
    cnameResults,
    initialDkimResults,
    delegatedNsResults,
  ] =
    await Promise.all([
      mxPromise,
      txtPromise,
      dmarcPromise,
      nsPromise,
      wildcardPromise,
      Promise.all(cnamePromises),
      Promise.all(dkimPromises),
      Promise.all(delegatedNsPromises),
    ]);

  const mailClassification = classifyMx(mxResult.value);
  const spf = await resolveSpfGraph(
    txtResult.value,
    (host) => query(() => resolver.resolveTxt(host)),
    { maxLookups: 10 },
  );
  const positiveCnames = cnameResults.filter((item) => item.value.length > 0);
  const cnameChains = [];
  for (const item of positiveCnames) {
    const paths = await followCnameChain(
      item.hostname,
      item.value,
      (host) => query(() => resolver.resolveCname(host)),
      { maxDepth: 3 },
    );
    cnameChains.push(...paths);
  }
  const chainObservations = cnameChains.flatMap((path) =>
    path.slice(2).map((target) => ({
      hostname: path[0],
      target,
      wildcardLike: false,
      cnameChain: path,
    })),
  );
  const cnameAnalysis = collapseWildcardLikeCnames(
    cnameResults,
    labels.length,
    wildcardResult.value,
  );
  cnameAnalysis.evidenceObservations.push(...chainObservations);

  const adaptiveSelectors = [
    ...new Set(
      spf.authorizedSenders.flatMap(
        (provider) => ADAPTIVE_DKIM_SELECTORS[provider] ?? [],
      ),
    ),
  ].slice(0, 2);
  const adaptiveDkimResults = [];
  for (const selector of adaptiveSelectors) {
    const hostname = `${selector}._domainkey.${domain}`;
    for (const type of ["CNAME", "TXT"]) {
      const result = await query(() =>
        type === "CNAME"
          ? resolver.resolveCname(hostname)
          : resolver.resolveTxt(hostname),
      );
      adaptiveDkimResults.push({ selector, hostname, type, ...result });
    }
  }
  const dkimResults = [...initialDkimResults, ...adaptiveDkimResults];
  const signals = cnameAnalysis.evidenceObservations
    .map(({ hostname, target, wildcardLike }) => {
      const signal = detectSalesVendor(hostname, target);
      return signal
        ? {
            ...signal,
            wildcardLikeCname: wildcardLike,
            rationale: wildcardLike
              ? `${signal.rationale} This target also answered for most candidate labels, so it is treated as one wildcard-like observation.`
              : signal.rationale,
          }
        : null;
    })
    .filter(Boolean);
  const detected = dedupeVendorSignals(signals);
  const queryErrors = [
    mxResult.error,
    txtResult.error,
    dmarcResult.error,
    nsResult.error,
    wildcardResult.error,
    ...cnameResults.map((item) => item.error),
    ...dkimResults.map((item) => item.error),
    ...delegatedNsResults.map((item) => item.error),
    ...spf.lookupErrors.map((item) => item.error),
  ].filter(Boolean);
  const mail = {
    ...mailClassification,
    queryStatus: {
      mx: mxResult.error ? "error" : "ok",
      spf: txtResult.error ? "error" : "ok",
      dmarc: dmarcResult.error ? "error" : "ok",
      dkim: dkimResults.some((item) => item.error) ? "partial" : "ok",
    },
    mx: mxResult.value
      .map(({ exchange, priority }) => ({
        exchange: exchange.replace(/\.$/, "").toLowerCase(),
        priority,
      }))
      .sort((a, b) => a.priority - b.priority),
    spf,
    dmarc: parseDmarc(dmarcResult.value),
    observedDkimSelectors: dkimResults
      .filter((item) => item.value.length > 0)
      .map((item) => ({
        selector: item.selector,
        hostname: item.hostname,
        type: item.type,
        value:
          item.type === "TXT"
            ? ["public-key-present"]
            : item.value.map((value) =>
                value.replace(/\.$/, "").toLowerCase(),
              ),
        ...(item.type === "CNAME"
          ? {
              providerAttribution: item.value
                .map(classifyDkimTarget)
                .filter(Boolean),
            }
          : {}),
      })),
  };
  const cnameTechnologySignals = cnameAnalysis.evidenceObservations
    .map(({ hostname, target, wildcardLike }) => {
      const signal = detectCnameTechnology(hostname, target);
      return signal ? { ...signal, wildcardLikeCname: wildcardLike } : null;
    })
    .filter(Boolean);
  const cnameServiceGroups = new Map();
  for (const signal of cnameTechnologySignals) {
    const evidence = cnameServiceGroups.get(signal.provider) ?? [];
    evidence.push(signal);
    cnameServiceGroups.set(signal.provider, evidence);
  }
  const allDomainVerifications = extractDomainVerifications(txtResult.value, {
    includeUnclassified: options.includeUnclassifiedVerifications,
  });
  const technologySignals = {
    dnsProvider: classifyDnsProvider(nsResult.value),
    domainVerifications: allDomainVerifications.filter(
      (finding) => finding.provider !== "Unclassified service",
    ),
    ...(options.includeUnclassifiedVerifications
      ? {
          unclassifiedDomainVerifications: allDomainVerifications.filter(
            (finding) => finding.provider === "Unclassified service",
          ),
        }
      : {}),
    authorizedEmailSenders: mail.spf.authorizedSenders,
    dmarcMonitoringServices: mail.dmarc.monitoringServices ?? [],
    delegatedServices: delegatedNsResults.flatMap((item) =>
      classifyDelegatedNameservers(item.value).map((finding) => ({
        ...finding,
        hostname: item.hostname,
      })),
    ),
    dkimServices: mail.observedDkimSelectors.flatMap((item) =>
      item.providerAttribution ?? [],
    ),
    cnameServices: [...cnameServiceGroups.values()].map((evidence) => ({
      provider: evidence[0].provider,
      category: evidence[0].category,
      confidence: evidence[0].confidence,
      evidence,
    })),
  };
  const technologyProfile = buildTechnologyProfile(technologySignals, {
    salesEngagement: detected,
  });

  const salesEngagement = {
    status: detected.length
      ? "signals_found"
      : "no_public_dns_signal_found",
    detected,
    labelsChecked: labels,
    observedCnames: cnameAnalysis.evidenceObservations.map((item) => ({
      hostname: item.hostname,
      targets: [item.target],
      wildcardLike: item.wildcardLike,
    })),
    wildcardLikeCnameTargets: cnameAnalysis.wildcardLikeTargets,
    observationsCollapsedAsWildcardLike: cnameAnalysis.observationsCollapsed,
    interpretation: detected.length
      ? "Public DNS contains vendor-attributable configuration. Treat it as strong evidence of setup, not proof of active licenses or recent use."
      : "No known signal was found. This does not mean the company does not use these tools: the subdomain name may be custom, proxied, unlisted, or tracking may be disabled.",
  };

  return {
    domain,
    status:
      mxResult.value.length || nsResult.value.length
        ? "ok"
        : "limited_dns_response",
    durationMs: Math.round(performance.now() - startedAt),
    mail,
    technologySignals,
    technologyProfile,
    technologyFingerprint: fingerprintTechnologyProfile(technologyProfile),
    querySafety: {
      mode: options.mode,
      queriesPlanned: fixedQueries + labels.length,
      queryAttempts,
      retryAttempts,
      retryReserve,
      maxQueriesPerDomain: MAX_QUERIES_PER_DOMAIN,
      perDomainConcurrency: PER_DOMAIN_QUERY_CONCURRENCY,
      minimumPerDomainStartDelayMs: QUERY_START_DELAY_MS,
      maxInflightDnsGlobal: options.maxInflightDns,
      maximumDnsStartsPerSecond: options.qps,
      candidateLabelsRequested: candidateLabels.length,
      candidateLabelsChecked: labels.length,
      candidateLabelsSkippedDueToBudget:
        candidateLabels.length - labels.length,
      adaptive: {
        spfLookups: spf.lookupCount,
        cnameChainsFollowed: cnameChains.length,
        adaptiveDkimSelectors: adaptiveSelectors,
        delegatedSubdomainsChecked: delegatedLabels,
        passiveCertificateLabels:
          options.passiveLabelsByDomain[domain]?.length ?? 0,
      },
      budgetExhausted,
    },
    salesEngagement,
    dns: {
      nameservers: nsResult.value.map((value) =>
        value.replace(/\.$/, "").toLowerCase(),
      ),
      wildcardProbe: {
        hostname: wildcardHostname,
        targets: wildcardResult.value.map((value) =>
          value.replace(/\.$/, "").toLowerCase(),
        ),
      },
      delegatedNameservers: delegatedNsResults
        .filter((item) => item.value.length > 0)
        .map((item) => ({
          hostname: item.hostname,
          nameservers: item.value.map((value) =>
            value.replace(/\.$/, "").toLowerCase(),
          ),
        })),
      cnameChains,
      nonAbsenceQueryErrors: [...new Set(queryErrors)],
    },
  };
}

export async function* scanDomainEvents(inputs, options = {}) {
  const config = buildConfig(options);
  const { domains, invalidInputs } = prepareInputs(inputs, config);
  const generatedAt = new Date().toISOString();
  const startedAt = performance.now();
  const methodology = buildMethodology(config);
  const scheduleGlobalDnsAttempt = createQueryLimiter(
    config.maxInflightDns,
    Math.ceil(1000 / config.qps),
  );

  yield {
    type: "meta",
    schemaVersion: "1.2",
    signatureCatalogVersion: SIGNATURE_CATALOG_VERSION,
    generatedAt,
    methodology,
    summary: {
      requested: inputs.length,
      scheduled: domains.length,
      invalid: invalidInputs.length,
    },
    invalidInputs,
  };

  let nextIndex = 0;
  let detectedDomains = 0;
  const active = new Map();
  const start = (index) => {
    const promise = scanDomain(domains[index], {
      ...config,
      scheduleGlobalDnsAttempt,
    }).then((result) => ({ index, result }));
    active.set(index, promise);
  };
  while (nextIndex < domains.length && active.size < config.concurrency) {
    start(nextIndex);
    nextIndex += 1;
  }
  while (active.size > 0) {
    const completed = await Promise.race(active.values());
    active.delete(completed.index);
    if (completed.result.salesEngagement.detected.length > 0) {
      detectedDomains += 1;
    }
    yield {
      type: "result",
      index: completed.index,
      result: completed.result,
    };
    if (nextIndex < domains.length) {
      start(nextIndex);
      nextIndex += 1;
    }
  }

  yield {
    type: "summary",
    schemaVersion: "1.2",
    signatureCatalogVersion: SIGNATURE_CATALOG_VERSION,
    generatedAt,
    durationMs: Math.round(performance.now() - startedAt),
    summary: {
      requested: inputs.length,
      scanned: domains.length,
      invalid: invalidInputs.length,
      domainsWithSalesEngagementSignals: detectedDomains,
    },
  };
}

export async function scanDomains(inputs, options = {}) {
  let meta;
  let summary;
  const results = [];
  for await (const event of scanDomainEvents(inputs, options)) {
    if (event.type === "meta") meta = event;
    if (event.type === "result") results[event.index] = event.result;
    if (event.type === "summary") summary = event;
  }
  return {
    schemaVersion: meta.schemaVersion,
    signatureCatalogVersion: meta.signatureCatalogVersion,
    generatedAt: meta.generatedAt,
    durationMs: summary.durationMs,
    methodology: meta.methodology,
    summary: summary.summary,
    invalidInputs: meta.invalidInputs,
    results,
  };
}
