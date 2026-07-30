import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDomainInput } from "../src/domain.mjs";

test("normalizes Salesforce-style website URLs to registrable domains", () => {
  assert.equal(
    normalizeDomainInput("https://www.Example.co.uk/about?source=crm"),
    "example.co.uk",
  );
  assert.equal(normalizeDomainInput("app.company.com"), "company.com");
});

test("respects private suffixes when finding a company domain", () => {
  assert.equal(normalizeDomainInput("https://tenant.github.io"), "tenant.github.io");
});

test("can preserve an explicitly supplied hostname", () => {
  assert.equal(
    normalizeDomainInput("https://sales.example.com/path", {
      preserveHostname: true,
    }),
    "sales.example.com",
  );
});

test("rejects IP addresses and hostnames without a registrable domain", () => {
  assert.throws(() => normalizeDomainInput("192.0.2.1"), /Invalid domain/);
  assert.throws(() => normalizeDomainInput("localhost"), /Invalid domain/);
});
