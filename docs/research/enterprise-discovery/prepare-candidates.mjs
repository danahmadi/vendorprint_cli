import { writeFile } from 'node:fs/promises';
const txt = [
 ['Docusign','docusign','business_software','docusign_organization_domain','https://support.docusign.com/s/document-item?bundleId=rrf1583359212854&language=fr&topicId=gso1583359141256.html'],
 ['Twilio','twilio-domain-verification','business_software','twilio_organization_domain','https://www.twilio.com/docs/iam/organizations/domains'],
 ['Cloudflare Dashboard SSO','cloudflare_dashboard_sso','identity_access','cloudflare_dashboard_sso_domain','https://developers.cloudflare.com/fundamentals/manage-members/dashboard-sso/'],
 ['Lovable','lovable_verification','ai_workspace','lovable_workspace_domain','https://docs.lovable.dev/features/verified-domains'],
 ['PandaDoc','pandadoc-domain-verification','business_software','pandadoc_sso_domain','https://support.pandadoc.com/en/articles/9715050-sso-implementation'],
 ['Remote','remote-domain-verification','business_software','remote_sso_domain','https://support.remote.com/hc/en-us/articles/31443994643725-SSO-Domain-Validation'],
 ['Sage Intacct','intacct-esk','business_software','sage_intacct_email_sender_key','https://www-p50491.intacct.com/ia/docs/en_US/help_action/Company/Company_setup/Company_Information/company-information.htm'],
 ['Snowflake','snowflake-verification','business_software','snowflake_organization_email_domain','https://docs.snowflake.com/en/user-guide/admin-domain-verification'],
].map(([provider,prefix,category,productScope,url])=>({family:'verification',provider,prefix,category,productScope,url}));
const candidates = [...txt,
 {family:'cname',provider:'Atlassian Statuspage',suffix:'stspg-customer.com',category:'customer_support',productScope:'statuspage_custom_domain',url:'https://support.atlassian.com/statuspage/docs/configure-your-dns'},
 {family:'cname',provider:'Auth0',suffix:'edge.tenants.auth0.com',category:'identity_access',productScope:'auth0_custom_authentication_domain',url:'https://auth0.com/blog/custom-domains-complete-guide/'},
 {family:'spf',provider:'Atlassian Statuspage',exact:'stspg-customer.com',productScope:'statuspage_notification_sending',url:'https://support.atlassian.com/statuspage/docs/configure-your-dns'},
];
await writeFile(new URL('candidates.json',import.meta.url),JSON.stringify({frozenAt:new Date().toISOString(),selection:'Recurring discovery-cohort observations plus explicit vendor documentation. Frozen before examining any holdout patterns. TXT rules require exact prefix and nonempty value; CNAME rules require hostname boundaries. No generic CDN, AWS, SendGrid, or guessed acronym attribution.',candidates},null,2)+'\n');
