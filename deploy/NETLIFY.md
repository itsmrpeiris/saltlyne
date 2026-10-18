# Netlify deployment

## Deploy the full site

Connect this repository to Netlify. `netlify.toml` sets the build command to `npm run build`, publishes `dist`, rewrites `/api/*` to the Netlify Function, and serves client-side routes such as `/collections/women` and `/admin` through the SPA.

The API is in `netlify/functions/api.mjs`. Catalogue and order records are stored in Netlify Database (Postgres), with schema migrations in `netlify/database/migrations/`. Netlify applies migrations during deploys once a database is attached to the site.

The customer rewards and coupon manager require migration `0004_customer_loyalty_coupons.sql`; it adds customer address/points fields and the coupon table, then backfills points once for existing non-cancelled orders. Migration `0005_customer_last_login.sql` adds last-login tracking. Migration `0006_customer_password_resets.sql` adds storage for one-time, expiring password-reset token hashes. Customer rewards are earned at 1 point per USD 1 of completed-order spend and redeemed at 100 points for USD 5. Checkout applies coupon and points discounts server-side in USD before currency conversion. The admin customer directory displays customer-submitted profile and order details, but never credentials or card data. The current store accepts manual bank transfer and cash on delivery only; do not store card numbers or CVV. Saved card support requires a tokenizing payment provider.

## One-time setup and data import

1. Authenticate the Netlify CLI with `netlify login`, connect this checkout to the intended site with `netlify link`, then create or attach the site's database from **Data & Storage → Database** (or run `netlify database init`). Confirm the site name and production/preview context before changing settings or importing data.
2. Configure these server environment variables in Netlify, for the production and deploy-preview contexts that need them. Use a new, strong password and separate random session secrets; do not commit them or send them in chat.
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `ADMIN_SESSION_SECRET`
   - `CUSTOMER_SESSION_SECRET`
   - `SUPPORT_EMAIL`
   - `EMAIL_FROM`
   - `PUBLIC_SITE_URL`
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   
   Generate `ADMIN_SESSION_SECRET` and `CUSTOMER_SESSION_SECRET` independently (for example, with `openssl rand -hex 32`) and paste each directly into the Netlify secret field. Do not reuse a password or share either value. `ADMIN_PASSWORD` should be a separate, unique password.
3. In Google Workspace, create or verify the `support@saltlyne.com` mailbox. For SMTP auth, use a Workspace app password created for that mailbox (where Workspace policy permits) or an administrator-configured Google SMTP relay. Never use the normal account password. Set the SMTP values in the Netlify secret manager, not in committed files.
4. Deploy after the database is attached so Netlify applies migrations `0001`–`0006`. To verify tables against the intended database, obtain its connection string privately and run `NETLIFY_DB_URL="<connection string>" npm run db:verify`; this prints only missing table/column names, never the connection string. Do not paste the URL into chat or commit it.
5. Test email transport against the configured SMTP service with `npm run email:verify`. The command sends one test message to `SUPPORT_EMAIL`; check the mailbox to confirm delivery. A successful SMTP handoff alone does not confirm inbox placement.
6. Test customer sign-in, request a password-reset link for an account you control, use the link once, and confirm the previous password no longer works. Reset links expire after 30 minutes; only token hashes are stored. Also test admin login and checkout on the deploy preview.
7. Before switching the custom domain or opening the new site to customers, import the current local store data only after verifying the destination is the intended production database. Obtain the database connection string privately and run `NETLIFY_DB_URL="<connection string>" npm run db:import`. The importer reads the ignored `server/data/store.json`, preserves product customizations, orders, customer accounts and addresses, loyalty balances, coupons, newsletter subscribers, and store content, and refuses to import the same snapshot twice.
8. Add the custom domain in Netlify and follow its DNS and HTTPS instructions at the registrar. Keep existing Google Workspace MX/TXT records when updating website records; do not switch nameservers without copying all mail records.

For local development against Netlify Functions and the local database emulator, run `npm run dev:netlify` after linking the project and setting both session secrets in the Netlify environment. The existing `npm run dev` continues to run the Node API for local development.

The importer copies the local JSON snapshot available in this checkout; it cannot retrieve data from an InfinityFree account. Take a fresh export/backup from the current live system before the import if it has newer products or orders.

## Notes

- `VITE_API_BASE_URL` stays unset because the API is same-origin through the `/api/*` rewrite.
- Customer passwords are scrypt-hashed and sessions are signed with `CUSTOMER_SESSION_SECRET`, separate from `ADMIN_SESSION_SECRET`. Password reset uses a random one-time link, persists only its SHA-256 hash, and invalidates existing customer sessions after use. Google Workspace email delivery requires the SMTP settings above.
- Checkout supports cash on delivery and manually confirmed Wise/bank transfer. It uses daily USD-based rates for LKR/USD/GBP/AUD display and snapshots the rate on the order. No card processor or automatic transfer verification is configured. Enable Wise transfer only after entering and verifying recipient details in the admin CMS.
- Netlify's built-in database and Functions have plan usage and billing limits. Review the current Netlify plan and database usage before launch.
- Keep InfinityFree and its DNS unchanged until the new deployment and imported data have been checked.
- The contact form sends inquiries to `support@saltlyne.com`; order confirmations/status changes and newsletter welcome/campaign messages use the configured SMTP account. Store SMTP secrets only in Netlify environment variables. For Google Workspace credentials and DNS setup, see [Namecheap DNS and Workspace email](./NAMECHEAP.md#keep-namecheap-dns-google-workspace-email-and-the-website-connected).

## Custom domain

Add the domain in Netlify after the site is connected, then follow Netlify's DNS instructions at the domain registrar. Leave InfinityFree in place until Netlify has issued HTTPS and the storefront and API paths have been checked on the new domain.
