import test from "node:test";
import assert from "node:assert/strict";
import { createDohResolver, parseDohResponse, parseDohTxt } from "../src/doh-resolver.mjs";

test("TXT answers preserve DNS chunks and accept unquoted JSON data", () => {
  assert.deepEqual(parseDohTxt('"v=spf1 include:a" " ~all"'), ["v=spf1 include:a", " ~all"]);
  assert.deepEqual(parseDohTxt('"quoted \\"value\\""'), ['quoted "value"']);
  assert.deepEqual(parseDohTxt('"hello\\032world"'), ["hello world"]);
  assert.deepEqual(parseDohTxt("google-site-verification=abc"), ["google-site-verification=abc"]);
  assert.throws(() => parseDohTxt('"unterminated'), { code: "EBADRESP" });
});

test("maps DoH answers into Node resolver shapes", async () => {
  const requests = [];
  const fixture = {
    MX: { Status: 0, Answer: [{ name: "example.com.", type: 15, data: "10 mail.example.net." }] },
    TXT: { Status: 0, Answer: [{ name: "example.com.", type: 16, data: '"v=spf1" " -all"' }] },
    NS: { Status: 0, Answer: [{ name: "example.com.", type: 2, data: "ns.example.net." }] },
    CNAME: { Status: 0, Answer: [{ name: "example.com.", type: 5, data: "target.example.net." }] },
  };
  const resolver = createDohResolver({
    timeoutMs: 900,
    request: async (url, timeout) => {
      requests.push({ url, timeout });
      return fixture[url.searchParams.get("type")];
    },
  });
  assert.deepEqual(await resolver.resolveMx("example.com"), [{ priority: 10, exchange: "mail.example.net" }]);
  assert.deepEqual(await resolver.resolveTxt("example.com"), [["v=spf1", " -all"]]);
  assert.deepEqual(await resolver.resolveNs("example.com"), ["ns.example.net"]);
  assert.deepEqual(await resolver.resolveCname("example.com"), ["target.example.net"]);
  assert.equal(requests.length, 4);
  assert.ok(requests.every(({ url, timeout }) => url.hostname === "dns.google" && timeout === 900));
});

test("absence differs from malformed, HTTP, and DNS server failures", () => {
  assert.throws(() => parseDohResponse({ Status: 3 }, "example.com", "MX"), { code: "ENOTFOUND" });
  assert.throws(() => parseDohResponse({ Status: 0 }, "example.com", "MX"), { code: "ENODATA" });
  assert.throws(() => parseDohResponse({ Status: 2 }, "example.com", "MX"), { code: "ESERVFAIL" });
  assert.throws(() => parseDohResponse({ Status: 0, Answer: {} }, "example.com", "MX"), { code: "EBADRESP" });
  assert.throws(() => parseDohResponse({ Status: 0, Answer: [{ name: "example.com", type: 15, data: "bad" }] }, "example.com", "MX"), { code: "EBADRESP" });
});
