import { domainToASCII } from "node:url";
import { getDomain } from "tldts";

export function normalizeDomainInput(input, options = {}) {
  const raw = String(input).trim();
  if (!raw) throw new Error("Domain cannot be empty");

  let hostname;
  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`,
    );
    hostname = url.hostname;
  } catch {
    throw new Error(`Invalid domain: ${input}`);
  }

  hostname = domainToASCII(hostname.toLowerCase().replace(/\.$/, ""));
  const registrableDomain = getDomain(hostname, { allowPrivateDomains: true });
  if (
    !registrableDomain ||
    hostname.length > 253 ||
    hostname.split(".").some((label) => !label || label.length > 63) ||
    !/^[a-z0-9.-]+$/.test(hostname)
  ) {
    throw new Error(`Invalid domain: ${input}`);
  }

  return options.preserveHostname ? hostname : registrableDomain;
}
