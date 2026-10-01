function normalizeHost(value) {
  return String(value)
    .trim()
    .replace(/^\*\./, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export async function readBoundedJson(response, maxBytes = MAX_RESPONSE_BYTES) {
  if (!response.body) {
    throw new Error("Certificate transparency response has no body");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  let complete = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        throw new Error(`Certificate transparency response exceeds ${maxBytes} byte limit`);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function extractCertificateHosts(payload, domain, options = {}) {
  const maxHosts = options.maxHosts ?? 20;
  const base = normalizeHost(domain);
  const rows = Array.isArray(payload) ? payload : [];
  const hosts = [];
  for (const row of rows) {
    for (const raw of String(row.name_value ?? "").split(/\r?\n/)) {
      const host = normalizeHost(raw);
      if (
        host !== base &&
        host.endsWith(`.${base}`) &&
        /^[a-z0-9.-]+$/.test(host) &&
        host.split(".").length === base.split(".").length + 1
      ) {
        hosts.push(host);
      }
    }
  }
  return [...new Set(hosts)].sort().slice(0, maxHosts);
}

export async function discoverCertificateHosts(domain, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxHosts = options.maxHosts ?? 20;
  const endpoint =
    options.endpoint ??
    `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`;
  const response = await fetchImpl(endpoint, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json", "user-agent": "vendorprint/0.1" },
  });
  if (!response.ok) {
    throw new Error(`Certificate transparency lookup failed (${response.status})`);
  }
  return {
    source: "certificate_transparency",
    endpointHost: new URL(endpoint).hostname,
    hosts: extractCertificateHosts(await readBoundedJson(response), domain, { maxHosts }),
  };
}
