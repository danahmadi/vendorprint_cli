import test from "node:test";
import assert from "node:assert/strict";
import { buildTechnologyInferenceGraph } from "../src/inference.mjs";

function service(provider, target, confidence = "high") {
  return {
    provider,
    confidence,
    evidence: [
      {
        provider,
        hostname: "go.example.com",
        target,
        confidence,
      },
    ],
  };
}

function signals(cnameServices, domainVerifications = []) {
  return {
    cnameServices,
    domainVerifications,
    authorizedEmailSenders: [],
  };
}

test("deduplicates Salesforce suite inferences and keeps the strongest rule", () => {
  const graph = buildTechnologyInferenceGraph(
    signals([
      service("Salesforce Pardot", "go.pardot.com"),
      service(
        "Salesforce Marketing Cloud Engagement",
        "tenant.sfmc-content.com",
      ),
    ]),
  );
  assert.equal(graph.inferred.length, 1);
  assert.equal(graph.inferred[0].provider, "Salesforce");
  assert.equal(graph.inferred[0].confidence, "high");
  assert.deepEqual(graph.inferred[0].ruleIds, [
    "pardot_implies_salesforce_crm",
    "sfmc_implies_salesforce_crm",
  ]);
});

test("keeps Marketo CRM as a non-exhaustive candidate set", () => {
  const graph = buildTechnologyInferenceGraph(
    signals([service("Adobe Marketo", "tenant.mktoweb.com")]),
  );
  const candidateSet = graph.candidateSets.find(
    (item) => item.subject === "marketo_crm_connector",
  );
  assert.equal(candidateSet.confidence, "low");
  assert.equal(candidateSet.exhaustive, false);
  assert.deepEqual(
    candidateSet.candidates.map((item) => item.provider),
    [
      "Salesforce",
      "Microsoft Dynamics 365",
      "Veeva CRM (Salesforce platform)",
      "Other or no native CRM",
    ],
  );
});

test("uses independent CRM evidence to narrow the Marketo candidate set", () => {
  const graph = buildTechnologyInferenceGraph(
    signals([
      service("Adobe Marketo", "tenant.mktoweb.com"),
      service("Salesforce", "tenant.siteforce.com"),
    ]),
  );
  const candidateSet = graph.candidateSets.find(
    (item) => item.subject === "marketo_crm_connector",
  );
  assert.equal(candidateSet.confidence, "medium");
  assert.deepEqual(candidateSet.candidates[0], {
    provider: "Salesforce",
    corroborated: true,
    observedConfidence: "high",
  });
  assert.equal(candidateSet.candidates.length, 4);
  assert.equal(candidateSet.candidates[1].corroborated, false);
  assert.match(candidateSet.rationale, /does not prove/);
});

test("Power Pages proves Dataverse while leaving Dynamics as a candidate", () => {
  const graph = buildTechnologyInferenceGraph(
    signals([
      service("Microsoft Power Pages", "tenant.powerappsportals.com"),
    ]),
  );
  assert.deepEqual(
    graph.inferred.map((item) => [item.provider, item.confidence]),
    [["Microsoft Dataverse", "high"]],
  );
  const candidateSet = graph.candidateSets.find(
    (item) => item.subject === "power_pages_business_application",
  );
  assert.equal(candidateSet.confidence, "low");
  assert.equal(candidateSet.candidates[0].provider, "Microsoft Dynamics 365");
});

test("sales-engagement CRM candidates narrow only with independent evidence", () => {
  const graph = buildTechnologyInferenceGraph(
    signals([service("HubSpot", "tenant.hubspot.net")]),
    {
      salesEngagement: [
        {
          provider: "Outreach",
          evidence: [
            {
              hostname: "go.example.com",
              target: "tenant.outrch.com",
              confidence: "high",
            },
          ],
        },
      ],
    },
  );
  const candidateSet = graph.candidateSets.find(
    (item) => item.subject === "sales_engagement_crm",
  );
  assert.equal(candidateSet.confidence, "medium");
  assert.deepEqual(candidateSet.candidates[2], {
    provider: "HubSpot",
    corroborated: true,
    observedConfidence: "medium",
  });
  assert.equal(candidateSet.candidates.length, 4);
});
