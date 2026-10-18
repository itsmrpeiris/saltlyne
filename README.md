# Saltlyne Label

Saltlyne Label is a React storefront with a local Node.js management API. The storefront includes a campaign hero, category navigation, search, product catalogue, cart, checkout, customer accounts, order tracking, and editable store content. Customer accounts include profile and address management, purchase and discount history, and a USD-based loyalty programme. The private admin desk manages customer profiles, products, order fulfilment and payment status, coupons, newsletter subscribers and campaigns, and storefront content through section-based editors for branding, announcements, payments, individual social icons and payment marks, collections, homepage sections, Explore, and help pages.

Loyalty earns 1 point for every USD 1 of completed-order spend; every 100 points can be redeemed for USD 5 off a future order. Checkout coupons and reward redemptions are calculated server-side in USD before currency conversion. Existing non-cancelled customer orders are backfilled once. Card numbers and CVV are never collected or stored; saved cards require a tokenizing payment provider.

## Start the website

1. Install dependencies once with `npm install`.
2. Run `npm run admin:setup` once if you have not set up the admin yet. It creates a random admin password and prints the login details. Save them somewhere private; the password is written to the ignored `.env` file.
3. Run `npm run dev`. This starts the API at `http://127.0.0.1:3001` and then starts the website once the API is ready.
4. Open the Vite URL (usually `http://localhost:5173`) and visit `http://localhost:5173/admin/login` to sign in.

The admin login email defaults to `owner@saltlynelabel.com`; `npm run admin:setup` prints the password. Run that setup command again if you need to rotate the password. Restart `npm run dev` after changing credentials.

## Deployment

For the Netlify setup, see [deploy/NETLIFY.md](deploy/NETLIFY.md). The Netlify Function serves `/api`, while Netlify Database stores catalogue and order data. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in the Netlify dashboard. Import the local store snapshot once before switching the domain.

InfinityFree static deployment instructions remain in [deploy/INFINITYFREE.md](deploy/INFINITYFREE.md). A Node-capable host can also serve the storefront and `/api` together with `npm start`; see [deploy/NAMECHEAP.md](deploy/NAMECHEAP.md). Never upload `.env` or database connection strings.

## Store management

- **Overview:** product, active-product, order, and low-stock counts.
- **Products:** add, edit, hide, remove, price, stock, department, category, subcategory, collection, activity, sizes, colours, and sale status. Merchandising controls include Featured, a Best Sellers pin, and Trending set to automatic, forced on, or excluded.
- **Orders:** review orders placed through checkout, update fulfilment status, and mark manual payments as received. Stock is reduced for orders and returned when an order is cancelled.
- **Store content:** edit announcement messages, payment methods/currencies, and manage each social and payment icon independently: create, edit, delete, enable/disable, assign HTTPS destinations, upload and crop artwork, and order icons (order 1 appears at the far right). Cropped WebP images and icon settings are saved with site content; one shared ordered list drives the storefront footers. Payment-mark links are informational only; they do not connect a gateway or process payments. Also edit collection hero copy/media, home slides and story, Explore launch/drop content, and help pages. Customer care uses `support@saltlyne.com`; the contact page has an on-site support form and a mail-app fallback.
- **Newsletter:** view and search subscribers by consent status, select/deselect subscribed recipients, and compose campaigns from reorderable text, image, divider, and HTTPS call-to-action blocks with a live preview and customizable colors. Images are optimized WebP attachments embedded into the email; campaigns include per-recipient unsubscribe links and the API excludes unsubscribed contacts even if a stale selection is submitted. Campaigns send in batches of 20. Newsletter management is separate from Website CMS.
- **Customer accounts:** customers can register, sign in, update their profile and password, and view orders linked to their email. Guest orders can be looked up using the order number and checkout email.
- **Checkout:** records orders in the local store database. Wise/bank transfer is a manual payment method and stays disabled until recipient details are entered; cash on delivery is enabled by default. Prices use daily USD-based LKR/USD/GBP/AUD exchange rates from Open ER-API. The rate is captured on each order; bank fees and final settlement may differ. Delivery charges are not calculated online and are quoted separately. No card processor or automatic transfer verification is connected, so do not treat this as a live card-payment portal.

Catalogue, orders, customers, newsletter subscribers, and editable store content are stored in `server/data/store.json`, which is created automatically and ignored by Git. Admin sessions use a separate HttpOnly cookie and last up to 12 hours. Customer passwords are scrypt-hashed; customer sessions use a different cookie and expire after 30 days. Changing a password invalidates existing customer sessions. Customers can request a one-time password-reset link, which expires after 30 minutes; only its SHA-256 token hash is stored. Restarting the local API signs all users out. SMTP delivery requires Google Workspace credentials in the server environment (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `SUPPORT_EMAIL`, and `PUBLIC_SITE_URL`); see [deploy/NAMECHEAP.md](deploy/NAMECHEAP.md) for setup. Use `npm run email:verify` to send a test message to `SUPPORT_EMAIL`; confirm receipt in the mailbox. `npm run db:verify` checks a Netlify database connection for required tables and columns without printing the connection string. A public launch still needs production hosting, HTTPS, persistent database backups, and—if online card payments are needed—an eligible merchant account and payment-provider integration.

The customer-facing routes include `/account`, `/orders/track`, `/products/:slug`, `/story`, and `/pages/:slug` for editable help pages.

## Collections and merchandising

- The storefront routes are `/collections/women`, `/collections/men`, and `/collections/accessories`.
- Collection links carry filters in the URL, so a menu link can open a specific category, subcategory, collection, or activity. Visitors can also combine category, collection, activity, size, colour, price, stock, sale, and Featured filters, then sort by Featured, Trending, Best Sellers, newest, or price.
- The shared product catalogue lives in `shared/catalog.js`; the Node API migrates existing product records to the department and merchandising fields when it starts.
- Checkout orders increase each item's order-unit count. Cancelling an order reverses those counts. Automatic Trending selects the three highest-count products in each department; admins can also force a product into Trending or exclude it. Best Sellers sort by order count, with an admin pin to feature a selection.
- Filter state is shareable as URL parameters such as `/collections/women?category=leggings&collection=coastline&subcategory=coastline`.
