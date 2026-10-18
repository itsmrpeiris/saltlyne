# Deploy Saltlyne Label with Namecheap

This project needs a Node.js web application host; a domain registration by itself does not run the storefront or its admin API. Namecheap documents Node.js apps in cPanel and supports the Node.js 24 runtime on eligible shared hosting plans. Confirm the plan you choose includes **cPanel → Setup Node.js App** before purchasing.

## Prepare the app

1. On your computer, run `npm run build`.
2. Package the project files for upload, including `package.json`, `package-lock.json`, `server/`, `shared/`, and the built `dist/` folder. The Node API imports the shared catalogue from `shared/`. Do not include `.env`, `.git/`, or `node_modules/`.
3. Keep a secure copy of your admin password. Generate a new production password rather than using the local development one.

## Create the Node app in cPanel

1. Open **cPanel → Setup Node.js App → Create Application**.
2. Choose Node.js **24** if available, **Production** mode, an application root such as `saltlyne-app`, the URL `https://saltlyne.com/`, and startup file `server/index.js`.
3. Upload the prepared files into the application root and use the cPanel app screen to run its npm install action if required.
4. In the application environment variables, set `NODE_ENV=production`, `ADMIN_EMAIL=owner@saltlynelabel.com`, and a new strong `ADMIN_PASSWORD`. Keep the password private. Do not set `API_PORT`; the hosting app supplies its port.
5. Start or restart the Node application. The site and its `/admin/login` page should now be served by the same app. The app creates `server/data/store.json` for products and orders; make regular backups of this file.

## Keep Namecheap DNS, Google Workspace email, and the website connected

The public DNS currently shows Namecheap registrar nameservers, the website pointed at Netlify (`www` CNAME to `saltlyne.netlify.app` and apex A record `75.2.60.5`), and Google Workspace's MX record (`smtp.google.com`, priority 1). This means Namecheap DNS is already connecting the domain to the website and Google handles incoming email. Do not switch nameservers or replace the website records just to set up email.

To verify or update records, open **Namecheap → Domain List → Manage → Advanced DNS**. Preserve the existing website records and the Google MX record. If Namecheap says DNS is not managed there, check **Nameservers** and edit records at the provider named there instead.

### Confirm the support mailbox

In the Google Admin console, create `support@saltlyne.com` as a mailbox and route it to the staff who should receive customer messages. A Google Group or alias can receive mail, but SMTP sending must authenticate as a Workspace mailbox authorized to send as `support@saltlyne.com`. The MX record routes mail for the domain to Google; it does not create the mailbox itself. Confirm that you can send and receive a test message in Gmail.

### Configure website email sending

The site sends customer-support inquiries and receipts, order confirmations and order/payment status updates, newsletter welcome messages, and CMS-created newsletter campaigns. Configure these values as server-side environment variables in **cPanel → Setup Node.js App** and in **Netlify → Site configuration → Environment variables** if the app is hosted there:

| Variable | Value |
| --- | --- |
| `SUPPORT_EMAIL` | `support@saltlyne.com` |
| `EMAIL_FROM` | `Saltlyne Label <support@saltlyne.com>` |
| `PUBLIC_SITE_URL` | `https://saltlyne.com` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `support@saltlyne.com` |
| `SMTP_PASS` | A Google Workspace app password, stored only as a hosting secret |

Generate an app password in the Google Account used for the support mailbox only if Workspace policy permits app passwords and 2-Step Verification is enabled. Never use the account's normal password or commit SMTP credentials to the repository. If app passwords are disabled, have the Workspace administrator configure the Google SMTP relay service and its authentication/TLS policy, then use those relay settings instead. Verify delivery with a test support inquiry and order before launch. Newsletter campaign sends are processed in batches of 20; keep campaigns appropriate for Google Workspace sending limits.

### Authenticate outgoing Google mail

The current public DNS lookup returned no TXT records at the domain root. If Google Workspace is the only service sending mail from `@saltlyne.com`, add this SPF record in Namecheap Advanced DNS (first check that an SPF record has not been added since this lookup):

| Type | Host | Value |
| --- | --- | --- |
| TXT Record | `@` | `v=spf1 include:_spf.google.com ~all` |

Set up DKIM in **Google Admin → Apps → Google Workspace → Gmail → Authenticate email**. Google generates a selector and a unique TXT value for the domain; add exactly the Host and TXT value Google provides in Namecheap. Do not copy a DKIM value from another domain or invent one.

After SPF and DKIM are active, you can add DMARC in Advanced DNS:

| Type | Host | Value |
| --- | --- | --- |
| TXT Record | `_dmarc` | `v=DMARC1; p=none; rua=mailto:support@saltlyne.com` |

Start with `p=none` and review authentication reports before considering a stricter policy. Avoid creating multiple SPF records; merge authorized senders into one record if other services also send email for the domain. Google notes DNS changes can take up to 48–72 hours to be recognized.

Official guidance: [Google Workspace MX records](https://support.google.com/a/answer/16004259), [SPF](https://support.google.com/a/answer/10685031), and [DMARC](https://support.google.com/a/answer/2466580).

## After launch

Visit `https://saltlyne.com/admin/login` and sign in with the production credentials. Test the contact form, order confirmation, status updates, newsletter signup/unsubscribe, and a small newsletter campaign. The mail-app link on the contact page remains available as a fallback.
