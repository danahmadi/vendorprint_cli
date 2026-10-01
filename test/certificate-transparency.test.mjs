import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverCertificateHosts,
  readBoundedJson,
} from "../src/certificate-transparency.mjs";

test("reads a bounded certificate response and preserves host filtering", async () => {
  const payload = [
    { name_value: "help.example.com\nother.test" },
    { name_value: "news.example.com" },
  ];
  const result = await discoverCertificateHosts("example.com", {
    fetchImpl: async () => new Response(JSON.stringify(payload)),
    maxHosts: 1,
  });
  assert.deepEqual(result.hosts, ["help.example.com"]);
});

test("rejects an oversized response before parsing it", async () => {
  const response = new Response("x".repeat(100));
  await assert.rejects(readBoundedJson(response, 32), /response exceeds 32 byte limit/);
});

test("reports HTTP failures without reading the body", async () => {
  await assert.rejects(
    discoverCertificateHosts("example.com", {
      fetchImpl: async () => new Response("error", { status: 503 }),
    }),
    /lookup failed \(503\)/,
  );
});
