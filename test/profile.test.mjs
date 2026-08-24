import test from "node:test";
import assert from "node:assert/strict";
import { buildTechnologyProfile } from "../src/profile.mjs";

test("separates AI, CRM, and marketing evidence with module caveats", () => {
  const profile = buildTechnologyProfile({
    domainVerifications: [
      {
        provider: "OpenAI",
        confidence: "medium",
        recordPrefix: "openai-domain-verification",
      },
      {
        provider: "HubSpot",
        confidence: "medium",
        recordPrefix: "hubspot-domain-verification",
      },
    ],
    authorizedEmailSenders: ["Salesforce", "Adobe Marketo"],
    cnameServices: [
      {
        provider: "Salesforce Pardot",
        evidence: [
          {
            hostname: "go.example.com",
            target: "go.pardot.com",
            confidence: "high",
          },
        ],
      },
      {
        provider: "Adobe Marketo",
        evidence: [
          {
            hostname: "pages.example.com",
            target: "123-abc-456.mktoweb.com",
            confidence: "high",
          },
        ],
      },
      {
        provider: "SparkPost",
        evidence: [
          {
            hostname: "email.example.com",
            target: "tenant.sparkpostmail.com",
            confidence: "high",
          },
        ],
      },
      {
        provider: "Salesforce Marketing Cloud Engagement",
        evidence: [
          {
            hostname: "cloud.example.com",
            target: "tenant.sfmc-content.com",
            confidence: "high",
          },
        ],
      },
    ],
  });

  assert.equal(profile.aiWorkspaces[0].provider, "OpenAI");
  assert.equal(
    profile.aiWorkspaces[0].productScope,
    "openai_organization_or_builder_profile",
  );
  assert.match(profile.aiWorkspaces[0].caveat, /does not by itself confirm ChatGPT Enterprise/);
  assert.equal(profile.aiWorkspaces[0].relationshipLevel, "domain_relationship");
  assert.equal(
    profile.crm.find((item) => item.provider === "Salesforce").confidence,
    "high",
  );
  assert.equal(
    profile.crm.find((item) => item.provider === "Salesforce")
      .relationshipLevel,
    "platform_configuration",
  );
  assert.equal(
    profile.marketingAutomation.find(
      (item) => item.provider === "Salesforce Account Engagement (Pardot)",
    ).confidence,
    "high",
  );
  assert.equal(
    profile.marketingAutomation.find(
      (item) => item.provider === "Adobe Marketo Engage",
    ).confidence,
    "high",
  );
  assert.equal(
    profile.marketingAutomation.find(
      (item) => item.provider === "Salesforce Marketing Cloud Engagement",
    ).relationshipLevel,
    "platform_configuration",
  );
  const inferredSalesforce = profile.crm.find(
    (item) =>
      item.provider === "Salesforce" &&
      item.productScope ===
        "salesforce_crm_inferred_from_marketing_products",
  );
  assert.equal(inferredSalesforce.confidence, "high");
  assert.equal(inferredSalesforce.relationshipLevel, "platform_configuration");
  assert.equal(inferredSalesforce.evidence[0].inferred, true);
  assert.deepEqual(
    inferredSalesforce.evidence
      .filter((item) => item.inferred)
      .map((item) => item.inferredFrom),
    [
      "Salesforce Account Engagement (Pardot)",
      "Salesforce Marketing Cloud Engagement",
    ],
  );
  assert.equal(profile.emailDelivery[0].provider, "SparkPost");
});

test("routes expanded GTM categories without changing legacy arrays", () => {
  const profile = buildTechnologyProfile(
    {
      domainVerifications: [
        {
          provider: "Segment",
          category: "customer_data",
          confidence: "medium",
          recordPrefix: "segment-site-verification",
        },
        {
          provider: "Fireflies.ai",
          category: "meeting_intelligence",
          confidence: "medium",
          recordPrefix: "fireflies-verification",
        },
      ],
      authorizedEmailSenders: [],
      cnameServices: [
        {
          provider: "Zendesk",
          category: "customer_support",
          evidence: [
            {
              hostname: "help.example.com",
              target: "tenant.zendesk.com",
              confidence: "high",
            },
          ],
        },
        {
          provider: "ActiveCampaign",
          category: "marketing_automation",
          evidence: [
            {
              hostname: "go.example.com",
              target: "tenant.activehosted.com",
              confidence: "high",
            },
          ],
        },
      ],
    },
    {
      salesEngagement: [
        {
          provider: "Outreach",
          confidence: "high",
          evidence: [
            {
              hostname: "click.example.com",
              target: "tenant.outrch.com",
              confidence: "high",
              relationship: "platform_configuration",
            },
          ],
        },
      ],
    },
  );
  assert.equal(profile.customerData[0].provider, "Segment");
  assert.equal(profile.meetingIntelligence[0].provider, "Fireflies.ai");
  assert.equal(profile.customerSupport[0].provider, "Zendesk");
  assert.equal(profile.salesEngagement[0].provider, "Outreach");
  assert.equal(profile.marketingAutomation[0].provider, "ActiveCampaign");
});

test("routes security, ITSM, business email, and automotive evidence", () => {
  const profile = buildTechnologyProfile({
    domainVerifications: [
      {
        provider: "KnowBe4",
        category: "security_compliance",
        confidence: "medium",
        recordPrefix: "knowbe4-site-verification",
      },
      {
        provider: "Duo SSO",
        category: "identity_access",
        confidence: "medium",
        recordPrefix: "duo_sso_verification",
      },
      {
        provider: "Zoho",
        category: "mail_productivity",
        confidence: "medium",
        recordPrefix: "zoho-verification",
      },
    ],
    authorizedEmailSenders: [
      "Sophos",
      "DealerSocket",
      "CDK Elead",
      "SimplePart",
      "Constant Contact",
      "Proton Mail",
    ],
    cnameServices: [
      {
        provider: "Freshservice",
        category: "it_service_management",
        evidence: [
          {
            hostname: "help.example.com",
            target: "tenant.freshservice.com",
            confidence: "high",
          },
        ],
      },
      {
        provider: "Showroom Logic",
        category: "advertising_abm",
        evidence: [
          {
            hostname: "offers.example.com",
            target: "retargeting.showroomlogic.com",
            confidence: "medium",
          },
        ],
      },
    ],
  });

  assert.equal(profile.securityAndCompliance.find((item) => item.provider === "KnowBe4").relationshipLevel, "domain_relationship");
  assert.equal(profile.securityAndCompliance.find((item) => item.provider === "Sophos").relationshipLevel, "sending_authorization");
  assert.equal(profile.identityAndAccess[0].provider, "Duo SSO");
  assert.deepEqual(
    profile.businessSoftware.map((item) => item.provider).sort(),
    ["Proton Mail", "Zoho"],
  );
  assert.equal(profile.itServiceManagement[0].provider, "Freshservice");
  assert.equal(profile.advertisingAndAbm[0].provider, "Showroom Logic");
  assert.deepEqual(
    profile.crm.map((item) => item.provider).sort(),
    ["CDK Elead", "DealerSocket"],
  );
  assert.equal(profile.commerceAndPayments[0].provider, "SimplePart");
  assert.equal(profile.marketingAutomation[0].provider, "Constant Contact");
});
