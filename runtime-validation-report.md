# Runtime Validation Report

**Generated:** 2026-10-18  
**Target:** Saltlyne storefront in this workspace

## Summary

| Step | Status | Exit code | Details |
|---|---|---:|---|
| Startup | PASS | 0 | The local Node API and Vite SPA started on isolated ports; `/api/health` returned 200. |
| Integration and browser tests | PASS | 0 | `npm test`: 4 Chromium journeys passed against an isolated JSON store and a local SMTP capture server. |
| Production build | PASS | 0 | `npm run build` succeeded; Vite reported a JavaScript bundle over 500 kB. |
| Lint | PASS with warnings | 0 | `npm run lint` succeeded with 6 existing React warnings. |
| Syntax and whitespace | PASS | 0 | Node syntax checks and `git diff --check` succeeded. |

**Overall:** NEEDS SIGN-OFF before relying on production accounts or taking live payments. Local customer/admin flows work. The linked production database is attached, but five migrations are pending; production email delivery is not yet verified.

## Environment and verdict

```text
environment:
  docker: UNAVAILABLE — docker info reported Docker NOT available
  node: AVAILABLE — v24.21.0
  playwright: AVAILABLE — Playwright 1.64.1; Chromium install completed successfully
  infra-tier: FALLBACK(local JSON store) — Docker is unavailable; production database status was checked separately through Netlify
  browser-tier: PRIMARY(Playwright Chromium)
startup: PASS — isolated Node API + Vite startup; /api/health returned 200
integration: PASS — exit_code: 0; passed: 4, failed: 0, skipped: 0; HTTP API and JSON persistence; PostgreSQL not exercised
e2e: PASS — exit_code: 0; passed: 4, failed: 0; customer account, admin catalog/CMS, guest checkout/order tracking, password recovery
overall: NEEDS_SIGNOFF — production migrations are pending and SMTP delivery remains unverified; production session secrets were configured but not runtime-tested
```

The four test files are run by `npm test`. Every test starts a fresh API and Vite instance and uses a temporary store that is removed afterward; it does not modify `server/data/store.json`.

## Browser journeys exercised

1. **Customer account:** invalid sign-in is rejected; registration, profile edits, and address creation succeed; the saved address is still shown after reload. The test also confirms account persistence and that the test customer record contains no card number or CVV.
2. **Admin and storefront:** unauthenticated access and an incorrect admin password are rejected; authenticated admin creates a product, which is returned by the storefront API and rendered in the catalog grid. CMS content writes persist and can be read back. The customer directory returns profile data without credential fields.
3. **Guest checkout and tracking:** protected account order history rejects an unauthenticated request; a guest order is created, retrieved by the order-tracking UI, and present in the admin order list.
4. **Password recovery:** the request UI sends through a local SMTP test server, unknown email addresses receive the same generic response, only the SHA-256 token hash is persisted, reset links expire after 30 minutes, successful reset is single-use, and prior customer sessions are revoked.

## Findings and recommendations

| Priority | Finding | Evidence / impact | Recommended action |
|---|---|---|---|
| High | Production password-recovery email is not verified. | The reset flow is implemented and passes against a local SMTP capture server, but Google Workspace credentials are unavailable in this environment. | Configure Workspace SMTP or the approved relay in Netlify, run `npm run email:verify`, check inbox delivery, then exercise a reset on the deploy preview. |
| High | Production account/admin authentication is not runtime-verified. | Netlify accepted fresh random `ADMIN_SESSION_SECRET` and `CUSTOMER_SESSION_SECRET` values as production Function secrets. Since the CLI does not reveal existing secret values or whether these keys previously existed, a prior signing key may have been replaced; no deployment or live sign-in test was performed. | Deploy only after the pending migrations are safely applied; expect existing signed sessions to require reauthentication if a key was replaced, then verify customer and admin sign-in. Keep values out of source control and chat. |
| High | Production migrations are pending and were not applied. | Netlify Database is attached to the `saltlyne` production target. Migration 0001 is applied; 0002–0006 are pending. Migration 0004 updates existing order loyalty-point values and customer balances. The user confirmed there is no verified, restorable backup, so production migrations were not run. | Create and verify a restorable production backup before approving migrations 0002–0006. Do not import local data as a substitute for a backup. |
| High | Google Workspace email delivery is not configured or verified. | No controlled email was sent. SMTP authentication requires a Workspace app password or authorized relay, which must be entered directly in Netlify's secret manager. | Add SMTP credentials directly in Netlify, then run the verification message to a mailbox you control and confirm inbox delivery. |
| High | Card processing is not implemented. | Checkout currently supports manual Wise/bank transfer and cash on delivery. Customer payment-method UI explicitly says saved cards are unavailable. No payment processor or automatic payment/refund flow was exercised. | Choose a PCI-compliant provider (for example, Stripe or another provider available to the business). Store only provider tokens and safe display metadata; never store raw card numbers or CVV. |
| Medium | Delivery and tax are not calculated in checkout. | The order confirmation and checkout copy state that delivery is quoted separately; no shipping-rate or tax calculation was found in the tested order path. | Before launch, define serviceable regions, delivery rates, tax rules, and how changes/refunds reconcile to order totals. |
| Medium | Prior login history cannot be backfilled from the current local data. | The two local customer records have no recorded last-login timestamp, and no trustworthy login audit source was available. The timestamp field only supports logins recorded going forward. | Keep the historical value unknown unless a trusted historical source is provided; retain login timestamps for future successful logins. |

## Feature connection snapshot

- Storefront product listing and product data are served by `/api/products`; admin product create/edit/delete is backed by `/api/admin/products`. Product creation was verified through admin UI and appeared in the storefront catalog.
- Store content is served by `/api/store-content` and managed through the admin CMS. An authenticated write/read-back was verified.
- Customer registration, sign-in, profile, addresses, rewards, password reset, and orders have local API routes; customer records, address/order data, and hashed reset tokens persist in the local JSON store. Customer admin listing/detail routes return a reduced profile view, not password hashes or session secrets.
- Checkout calculates order totals on the server and stores orders; guest order lookup uses the order ID and checkout email. Admin order viewing and status/payment-status controls are present. No provider-verified payment, automated refunds, shipping charge, or tax calculation was validated.
- Newsletter and support forms have API routes, and admin newsletter management exists; outbound delivery remains unverified without SMTP.
- The linked Netlify production database reports `0001_create_store_tables` applied and migrations `0002_store_content_customers` through `0006_customer_password_resets` pending. No production migration or data import was run because a verified backup is unavailable.
- `npm run db:verify` and `npm run email:verify` are available after secrets are configured. In this run, database verification stopped because no connection string was available; email verification stopped because neither SMTP credentials nor an authorized Workspace relay was configured.

## Legacy test assets

No pre-existing test suite or test command was present. `npm test` now runs four isolated Playwright-backed flows in `tests/runtime-validation/`.
