# Saltlyne storefront on InfinityFree

InfinityFree serves the compiled storefront as static files. The product and order management API remains a separate Node.js service; InfinityFree free hosting cannot run that API.

## Build and upload the storefront

1. In the project folder, run `npm install` and `npm run build`.
2. Open the InfinityFree account for `saltlyne.infinityfree.io`, then open **File Manager**.
3. Upload the *contents* of the project's `dist/` folder to the domain's `htdocs/` folder. Upload `index.html`, `.htaccess`, `config.js`, `saltlyne-hero.mp4`, and the generated `assets/` folder. Do not upload the source project, `.env`, `.git`, or `node_modules`.
4. Visit `https://saltlyne.infinityfree.io`. The `.htaccess` file routes storefront paths back through the React app.

## Connect the store API

Until the Node API is deployed, the storefront uses its built-in sample catalogue and the admin, live product management, and checkout endpoints will not work from InfinityFree.

After deploying the Node API to a Node-capable host:

1. Set `CORS_ORIGINS` on the API to the exact storefront origins, comma separated. For example: `https://saltlyne.com,https://www.saltlyne.com,https://saltlyne.infinityfree.io`.
2. In InfinityFree **File Manager → htdocs → config.js**, set the API origin, with no trailing slash. Example: `window.SALTLYNE_API_BASE_URL = "https://api.saltlyne.com";`.
3. Confirm the API is available at `https://api.saltlyne.com/api/health`, then reload the storefront. The admin sign-in will be at `/admin/login` on whichever storefront domain you use.

The API must use HTTPS for production. Keep admin credentials in the API host's environment settings; never put them in `config.js` or upload `.env`.

## Connect saltlyne.com

Add `saltlyne.com` as a custom domain in the InfinityFree dashboard and follow the nameserver or DNS instructions shown there. Then in the Namecheap domain panel, apply the exact DNS values InfinityFree provides. Do not guess IP addresses or replace existing mail records. Keep `saltlyne.infinityfree.io` available as a preview address while DNS updates.

The `saltlyne.com` storefront can be connected as soon as the static files are uploaded. The domain connection does not deploy or connect the Node API; that remains a separate setup.
