# Storefront and backend parity

- Treat every customer-facing storefront change as a full-stack feature: trace its form inputs, actions, displayed data, and state changes through server-side validation, persistence, and an admin/operations workflow where store staff need to manage it.
- Keep the local Node API and Netlify Function API behavior aligned. Add and document a database migration for persisted Netlify data; preserve existing store data during imports and backfills.
- Make the server authoritative for customer, order, pricing, coupon, rewards, inventory, and payment state. Do not trust client-submitted prices, balances, permissions, or status changes.
- Collect and retain only information needed for the requested store function. Never expose credentials, password hashes, session tokens, full card numbers, or CVV in admin APIs or interfaces.
- Update related admin screens, customer-facing error/success states, documentation, and focused tests whenever they are part of the feature.
