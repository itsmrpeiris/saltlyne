import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { apiRequest, assertNoStoredCredentials, startTestApp } from "./helpers.js";
import { mergeStoreContent } from "../../shared/storeContent.js";

function iconByKey(icons, key) {
    return icons.find((icon) => icon.key === key);
}

test("admin access controls product and CMS changes that appear in the storefront", async (t) => {
    const app = await startTestApp();
    t.after(() => app.close());
    const page = await app.browser.newPage();

    const unauthorized = await apiRequest(app.apiUrl, "/admin/products");
    assert.equal(unauthorized.status, 401, "admin management is protected");

    await page.goto(`${app.url}/admin/login`);
    await page.getByLabel("Password").fill("invalid-test-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("alert").getByText("Email or password is incorrect.").waitFor();
    await page.getByLabel("Password").fill("test-only-admin-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("heading", { name: "Good morning." }).waitFor();
    const adminSession = (await page.context().cookies(app.url))
        .find((entry) => entry.name === "saltlyne_session");
    assert.ok(adminSession, "successful admin login sets an HttpOnly session cookie");
    const adminCookie = `${adminSession.name}=${adminSession.value}`;
    await page.getByRole("link", { name: "Products", exact: true }).click();
    await page.getByRole("button", { name: "Add product" }).click();
    const merchandisingReadability = await page.evaluate(() => {
        document.documentElement.classList.add("is-art-mode");
        const panel = document.querySelector(".admin-merchandising-controls");
        const label = panel.querySelector(".admin-check");
        return {
            panelBackground: getComputedStyle(panel).backgroundColor,
            labelColor: getComputedStyle(label).color,
            eyebrowColor: getComputedStyle(panel.querySelector(".admin-eyebrow")).color,
        };
    });
    assert.equal(merchandisingReadability.panelBackground, "rgba(0, 0, 0, 0)", "merchandising controls stay simple without an extra panel");
    assert.equal(merchandisingReadability.labelColor, "rgb(244, 246, 250)", "admin labels remain readable on the dark form surface");
    assert.equal(merchandisingReadability.eyebrowColor, "rgb(244, 246, 250)", "admin panel headings remain readable on the dark form surface");
    await page.evaluate(() => document.documentElement.classList.remove("is-art-mode"));
    const productName = `Runtime test ${Date.now()}`;
    await page.getByLabel("Product name").fill(productName);
    await page.getByLabel("Price (USD)").fill("29.99");
    await page.getByLabel("Stock quantity").fill("4");
    await page.getByRole("button", { name: "Save product" }).click();
    await page.getByText(productName).waitFor();

    const products = await apiRequest(app.apiUrl, "/products");
    const product = products.data.find((entry) => entry.name === productName);
    assert.ok(product, "admin-created product is available to storefront API");
    assert.equal(product.price, 29.99);
    assert.equal(product.stock, 4);
    await page.goto(`${app.url}/collections/women?sort=newest`);
    await page.getByText(productName).waitFor();

    await page.goto(`${app.url}/admin/content`);
    await page.getByRole("link", { name: "Website CMS" }).click();
    await page.getByRole("button", { name: "Save and publish" }).waitFor();
    const content = await apiRequest(app.apiUrl, "/admin/store-content", { cookie: adminCookie });
    const legacyContent = structuredClone(content.data);
    delete legacyContent.settings.social;
    delete legacyContent.paymentIcons;
    const upgradedLegacyContent = mergeStoreContent(legacyContent, { settings: { announcementActive: true } });
    assert.ok(iconByKey(upgradedLegacyContent.settings.social, "facebook"), "legacy CMS records receive default social icon settings");
    assert.ok(iconByKey(upgradedLegacyContent.paymentIcons, "visa"), "legacy CMS records receive default payment icon settings");
    const unsafeLinks = await apiRequest(app.apiUrl, "/admin/store-content", {
        method: "PUT",
        cookie: adminCookie,
        body: {
            ...content.data,
            settings: {
                ...content.data.settings,
                social: content.data.settings.social.map((icon) => icon.key === "facebook" ? { ...icon, url: "javascript:alert(1)" } : icon),
            },
        },
    });

    test("newsletter admin manages recipient consent and sends designed image campaigns only to selected subscribers", async (t) => {
        const app = await startTestApp();
        t.after(() => app.close());
        const emails = ["newsletter-active-one@example.test", "newsletter-active-two@example.test", "newsletter-unsubscribed@example.test"];
        for (const email of emails) {
            const signup = await apiRequest(app.apiUrl, "/newsletter", { method: "POST", body: { email, name: email.split("@")[0], consent: true } });
            assert.equal(signup.status, 201);
        }
        const store = JSON.parse(await readFile(app.storeFile, "utf8"));
        const unsubscribed = store.newsletterSubscribers.find((subscriber) => subscriber.email === emails[2]);
        const unsubscribe = await apiRequest(app.apiUrl, "/newsletter/unsubscribe", { method: "POST", body: { token: unsubscribed.unsubscribeToken } });
        assert.equal(unsubscribe.status, 200);

        const unauthorized = await apiRequest(app.apiUrl, "/admin/newsletter/campaign", {
            method: "POST",
            body: { subject: "Test", selectedEmails: emails, blocks: [{ type: "paragraph", text: "This should not send." }] },
        });
        assert.equal(unauthorized.status, 401, "campaign sending requires an admin session");
        const login = await apiRequest(app.apiUrl, "/auth/login", { method: "POST", body: { email: "owner@saltlynelabel.com", password: "test-only-admin-password" } });
        assert.equal(login.status, 200);
        const adminCookie = login.cookie;
        const rejectedUnsubscribedRecipient = await apiRequest(app.apiUrl, "/admin/newsletter/campaign", {
            method: "POST",
            cookie: adminCookie,
            body: {
                subject: "Consent enforcement",
                selectedEmails: [emails[2]],
                blocks: [{ type: "paragraph", text: "This message must not be sent." }],
            },
        });
        assert.equal(rejectedUnsubscribedRecipient.status, 400, "the API rejects selections with no currently subscribed contacts");
        assert.match(rejectedUnsubscribedRecipient.data.error, /currently subscribed/i);
        const mixedConsentSelection = await apiRequest(app.apiUrl, "/admin/newsletter/campaign", {
            method: "POST",
            cookie: adminCookie,
            body: {
                subject: "Live consent check",
                selectedEmails: [emails[1], emails[2]],
                blocks: [{ type: "paragraph", text: "Only the opted-in recipient should receive this." }],
            },
        });
        assert.equal(mixedConsentSelection.status, 200);
        assert.equal(mixedConsentSelection.data.total, 1, "the server drops unsubscribed addresses from mixed selections");
        assert.equal(mixedConsentSelection.data.sent, 1);
        assert.match(app.sentEmails.at(-1), /To: newsletter-active-two@example\.test/i);
        assert.doesNotMatch(app.sentEmails.at(-1), /newsletter-unsubscribed@example\.test/i);

        const page = await app.browser.newPage();
        await page.goto(`${app.url}/admin/login`);
        await page.getByLabel("Password").fill("test-only-admin-password");
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.getByRole("heading", { name: "Good morning." }).waitFor();
        await page.getByRole("link", { name: "Newsletter", exact: true }).click();
        await page.getByRole("heading", { name: /2 subscribed \/ 1 unsubscribed/i }).waitFor();
        const previewReadability = await page.evaluate(() => {
            document.documentElement.classList.add("is-art-mode");
            return {
                label: getComputedStyle(document.querySelector(".newsletter-preview .admin-eyebrow")).color,
                subject: getComputedStyle(document.querySelector(".newsletter-preview h3")).color,
            };
        });
        assert.equal(previewReadability.label, "rgb(2, 54, 97)", "newsletter preview labels remain visible in Art Mode");
        assert.equal(previewReadability.subject, "rgb(52, 65, 57)", "newsletter subject text remains dark on its light preview");
        await page.evaluate(() => document.documentElement.classList.remove("is-art-mode"));
        assert.equal(await page.locator(".admin-table-wrap tbody tr").count(), 2, "the initial subscribed filter excludes unsubscribed contacts");
        await page.getByRole("button", { name: "Select visible subscribed" }).click();
        await page.getByText("2 selected", { exact: true }).waitFor();
        await page.getByRole("button", { name: "Deselect visible" }).click();
        await page.getByText("0 selected", { exact: true }).waitFor();
        await page.getByLabel("Subscription status").selectOption("unsubscribed");
        const unsubscribedCheckbox = page.getByRole("checkbox", { name: emails[2] });
        await unsubscribedCheckbox.waitFor();
        assert.equal(await unsubscribedCheckbox.isDisabled(), true);
        await page.getByLabel("Subscription status").selectOption("subscribed");
        await page.getByRole("checkbox", { name: emails[0] }).check();
        await page.getByLabel("Email subject").fill("Fresh from Saltlyne");
        await page.getByLabel("Button & link color").fill("#c06040");
        await page.getByLabel("paragraph text").fill("A personal update with a new-season preview.");
        await page.getByRole("button", { name: "＋ Image" }).click();
        await page.getByLabel("Upload newsletter image").setInputFiles({
            name: "newsletter.png",
            mimeType: "image/png",
            buffer: await readFile(new URL("../../public/images/saltlyne-logo-black.png", import.meta.url)),
        });
        await page.getByLabel("Image description").fill("Saltlyne wordmark");
        await page.getByRole("button", { name: "＋ Button" }).click();
        await page.getByLabel("Button label").fill("Explore the new collection");
        await page.getByText("Explore the new collection", { exact: true }).waitFor();
        const emailCountBeforeCampaign = app.sentEmails.length;
        page.once("dialog", (dialog) => dialog.accept());
        await page.getByRole("button", { name: "Send newsletter" }).click();
        await page.getByText(/Newsletter sent to 1 of 1 selected subscribed recipients/).waitFor();
        assert.equal(app.sentEmails.length, emailCountBeforeCampaign + 1, "one email is delivered for the one selected subscriber");
        const campaignEmail = app.sentEmails.at(-1);
        assert.match(campaignEmail, /To: newsletter-active-one@example\.test/i);
        assert.doesNotMatch(campaignEmail, /newsletter-active-two@example\.test|newsletter-unsubscribed@example\.test/i);
        assert.match(campaignEmail, /Content-Type: text\/html/i);
        assert.match(campaignEmail, /Content-ID: <newsletter-image-/i);
        assert.match(campaignEmail, /image\/webp/i);
        assert.match(campaignEmail, /c06040/i, "the configured campaign palette is used in the email HTML");
        assert.match(campaignEmail, /Unsubscribe from these emails/i);
        assert.match(campaignEmail, /Explore the new collection/);

        await page.getByRole("link", { name: "Website CMS" }).click();
        await page.getByRole("heading", { name: "Website CMS" }).waitFor();
        assert.equal(await page.getByText("CAMPAIGN DESIGNER").count(), 0, "newsletter composer is no longer inside Website CMS");
        assert.equal(await page.getByText("active newsletter subscribers").count(), 0, "subscriber controls are no longer inside Website CMS");
    });
    assert.equal(unsafeLinks.status, 400, "CMS rejects non-HTTPS icon destinations");
    const save = await apiRequest(app.apiUrl, "/admin/store-content", {
        method: "PUT",
        cookie: adminCookie,
        body: {
            ...content.data,
            settings: {
                ...content.data.settings,
                siteAnnouncement: { ...content.data.settings.siteAnnouncement, text: "Runtime check saved content" },
                social: content.data.settings.social.map((icon) => icon.key === "facebook"
                    ? { ...icon, enabled: true, url: "https://facebook.com/saltlyne-test" }
                    : icon.key === "instagram" ? { ...icon, enabled: false, url: "" } : { ...icon, url: `https://example.test/${icon.key}` }),
            },
            paymentIcons: content.data.paymentIcons.map((icon) => icon.key === "visa"
                ? { ...icon, enabled: true, url: "https://www.visa.com/" }
                : icon.key === "amex" ? { ...icon, enabled: false, url: "" } : icon),
        },
    });
    assert.equal(save.status, 200);
    const savedContent = await apiRequest(app.apiUrl, "/store-content");
    assert.equal(savedContent.data.settings.siteAnnouncement.text, "Runtime check saved content");
    assert.equal(iconByKey(savedContent.data.settings.social, "facebook").url, "https://facebook.com/saltlyne-test");
    assert.equal(iconByKey(savedContent.data.settings.social, "instagram").enabled, false);
    assert.equal(iconByKey(savedContent.data.paymentIcons, "visa").url, "https://www.visa.com/");
    assert.equal(iconByKey(savedContent.data.paymentIcons, "amex").enabled, false);
    await page.goto(`${app.url}/admin/content`);
    await page.getByRole("link", { name: "Website CMS" }).click();
    await page.getByRole("button", { name: "Save and publish" }).waitFor();
    await page.getByRole("tab", { name: "Social icons" }).click();
    const facebookCard = page.locator(".cms-icon-card").filter({ hasText: "Facebook" });
    const socialUrl = page.getByRole("tabpanel").getByLabel("Social profile URL (HTTPS)");
    await facebookCard.getByRole("button", { name: "Edit" }).click();
    assert.equal(await socialUrl.inputValue(), "https://facebook.com/saltlyne-test");
    await socialUrl.fill("https://facebook.com/cms-edited");
    await page.getByRole("button", { name: "Save icon" }).click();
    await page.getByRole("tab", { name: "Payment icons" }).click();
    await page.locator(".cms-icon-card").filter({ hasText: "American Express" }).waitFor();
    await page.getByRole("tab", { name: "Brand & announcements" }).click();
    await page.getByRole("tab", { name: "Social icons" }).click();
    await page.getByRole("button", { name: "Create social icon" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Runtime social");
    await page.getByLabel("Social profile URL (HTTPS)").fill("https://example.test/runtime-social");
    await page.getByLabel("Upload icon image").setInputFiles({
        name: "runtime-social.png",
        mimeType: "image/png",
        buffer: await readFile(new URL("../../public/images/saltlyne-logo-black.png", import.meta.url)),
    });
    await page.getByRole("button", { name: "Use this crop" }).click();
    await page.getByRole("button", { name: "Add icon" }).click();
    await page.getByRole("button", { name: "Save and publish" }).click();
    await page.getByText("Store content saved and published.").waitFor();
    const customIconContent = await apiRequest(app.apiUrl, "/store-content");
    const customIcon = customIconContent.data.settings.social.find((icon) => icon.name === "Runtime social");
    assert.ok(customIcon, "new social icons are saved in CMS content");
    assert.match(customIcon.image, /^data:image\/webp;base64,/);
    assert.equal(customIcon.order, 2, "a newly created icon is placed beside the rightmost icon");
    await page.goto(app.url);
    const customSocialLink = page.getByRole("link", { name: "Visit Saltlyne on Runtime social" });
    await customSocialLink.waitFor();
    assert.equal(await customSocialLink.getAttribute("href"), "https://example.test/runtime-social");
    await page.goto(`${app.url}/admin/content`);
    await page.getByRole("tab", { name: "Social icons" }).click();
    await page.locator(".cms-icon-card").filter({ hasText: "Runtime social" }).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Social profile URL (HTTPS)").fill("https://example.test/edited-social");
    await page.getByRole("button", { name: "Save icon" }).click();
    await page.getByRole("button", { name: "Save and publish" }).click();
    await page.getByText("Store content saved and published.").waitFor();
    const dialogResult = new Promise((resolve) => page.once("dialog", (dialog) => { resolve(dialog.message()); dialog.accept(); }));
    await page.locator(".cms-icon-card").filter({ hasText: "Runtime social" }).getByRole("button", { name: "Delete" }).click();
    assert.match(await dialogResult, /Delete the Runtime social social icon/);
    await page.getByRole("button", { name: "Save and publish" }).click();
    await page.getByText("Store content saved and published.").waitFor();
    const deletedContent = await apiRequest(app.apiUrl, "/store-content");
    assert.equal(deletedContent.data.settings.social.some((icon) => icon.name === "Runtime social"), false);
    const threadDialog = new Promise((resolve) => page.once("dialog", (dialog) => { resolve(dialog.message()); dialog.accept(); }));
    await page.locator(".cms-icon-card").filter({ hasText: "Threads" }).getByRole("button", { name: "Delete" }).click();
    assert.match(await threadDialog, /Delete the Threads social icon/);
    await page.getByRole("button", { name: "Save and publish" }).click();
    await page.getByText("Store content saved and published.").waitFor();
    const deletedBuiltInContent = await apiRequest(app.apiUrl, "/store-content");
    assert.equal(deletedBuiltInContent.data.settings.social.some((icon) => icon.key === "threads"), false, "deleting a built-in icon persists without restoring its default");
    const cmsSavedContent = await apiRequest(app.apiUrl, "/store-content");
    assert.equal(iconByKey(cmsSavedContent.data.settings.social, "facebook").url, "https://facebook.com/cms-edited");
    await page.goto(app.url);
    const facebookLink = page.getByRole("link", { name: "Visit Saltlyne on Facebook" });
    await facebookLink.waitFor();
    assert.equal(await facebookLink.getAttribute("href"), "https://facebook.com/cms-edited");
    assert.equal(await page.locator('[aria-label="Instagram"]').count(), 0, "disabled social icon is not rendered");
    await page.goto(`${app.url}/collections/women`);
    const visaLink = page.getByRole("link", { name: "Visit Visa payment information" });
    await visaLink.waitFor();
    assert.equal(await visaLink.getAttribute("href"), "https://www.visa.com/");
    assert.equal(await page.locator('[aria-label="American Express"]').count(), 0, "disabled payment icon is not rendered");
    await page.goto(app.url);
    await page.locator('[aria-label="Social media"] > a').first().waitFor();
    const homepageOrder = await page.locator('[aria-label="Social media"] > a').evaluateAll((links) => links.map((link) => link.getAttribute("aria-label")));
    await page.goto(`${app.url}/explore`);
    await page.locator('[aria-label="Social media"] > a').first().waitFor();
    const exploreOrder = await page.locator('[aria-label="Social media"] > a').evaluateAll((links) => links.map((link) => link.getAttribute("aria-label")));
    assert.deepEqual(exploreOrder, homepageOrder, "social icon ordering is shared across storefront footers");

    await page.goto(`${app.url}/admin/content`);
    await page.getByRole("tab", { name: "Payment icons" }).click();
    await page.getByRole("button", { name: "Create payment icon" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Runtime gateway");
    await page.getByLabel("Payment information URL (HTTPS)").fill("https://example.test/runtime-gateway");
    await page.getByLabel("Upload icon image").setInputFiles({
        name: "runtime-gateway.png",
        mimeType: "image/png",
        buffer: await readFile(new URL("../../public/images/saltlyne-logo-black.png", import.meta.url)),
    });
    await page.getByRole("button", { name: "Use this crop" }).click();
    assert.equal(await page.locator("canvas[aria-label='Wide crop preview']").getAttribute("width"), "384");
    await page.getByRole("button", { name: "Add icon" }).click();
    await page.getByRole("button", { name: "Save and publish" }).click();
    await page.getByText("Store content saved and published.").waitFor();
    const paymentContent = await apiRequest(app.apiUrl, "/store-content");
    const customPayment = paymentContent.data.paymentIcons.find((icon) => icon.name === "Runtime gateway");
    assert.ok(customPayment);
    assert.match(customPayment.image, /^data:image\/webp;base64,/);
    await page.goto(`${app.url}/collections/women`);
    const customPaymentLink = page.getByRole("link", { name: "Visit Runtime gateway payment information" });
    await customPaymentLink.waitFor();
    assert.equal(await customPaymentLink.getAttribute("href"), "https://example.test/runtime-gateway");
    await page.goto(`${app.url}/explore`);
    const explorePaymentLink = page.getByRole("link", { name: "Visit Runtime gateway payment information" });
    await explorePaymentLink.waitFor();
    assert.equal(await explorePaymentLink.getAttribute("href"), "https://example.test/runtime-gateway");
    await page.goto(`${app.url}/admin/content`);
    await page.getByRole("tab", { name: "Payment icons" }).click();
    await page.locator(".cms-icon-card").filter({ hasText: "Runtime gateway" }).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Payment information URL (HTTPS)").fill("https://example.test/edited-gateway");
    await page.getByRole("button", { name: "Save icon" }).click();
    await page.getByRole("button", { name: "Save and publish" }).click();
    await page.getByText("Store content saved and published.").waitFor();
    const editedPaymentContent = await apiRequest(app.apiUrl, "/store-content");
    assert.equal(editedPaymentContent.data.paymentIcons.find((icon) => icon.name === "Runtime gateway").url, "https://example.test/edited-gateway");
    const paymentDialog = new Promise((resolve) => page.once("dialog", (dialog) => { resolve(dialog.message()); dialog.accept(); }));
    await page.locator(".cms-icon-card").filter({ hasText: "Runtime gateway" }).getByRole("button", { name: "Delete" }).click();
    assert.match(await paymentDialog, /Delete the Runtime gateway payment icon/);
    await page.getByRole("button", { name: "Save and publish" }).click();
    await page.getByText("Store content saved and published.").waitFor();
    const deletedPaymentContent = await apiRequest(app.apiUrl, "/store-content");
    assert.equal(deletedPaymentContent.data.paymentIcons.some((icon) => icon.name === "Runtime gateway"), false);

    const persisted = JSON.parse(await readFile(app.storeFile, "utf8"));
    assert.ok(persisted.products.some((entry) => entry.name === productName));
    assert.equal(persisted.siteContent.settings.siteAnnouncement.text, "Runtime check saved content");
    assert.equal(iconByKey(persisted.siteContent.settings.social, "facebook").url, "https://facebook.com/cms-edited");
    assert.equal(iconByKey(persisted.siteContent.paymentIcons, "visa").url, "https://www.visa.com/");
    const customers = await apiRequest(app.apiUrl, "/admin/customers", { cookie: adminCookie });
    assert.equal(customers.status, 200);
    const customer = await apiRequest(app.apiUrl, "/account/register", {
        method: "POST",
        body: { name: "Admin Test Customer", email: `admin-${Date.now()}@example.test`, password: "Runtime-Admin-Customer-Password-482!" },
    });
    assert.equal(customer.status, 201);
    const customerDirectory = await apiRequest(app.apiUrl, "/admin/customers", { cookie: adminCookie });
    assert.ok(customerDirectory.data.some((entry) => entry.id === customer.data.id));
    const customerDetails = await apiRequest(app.apiUrl, `/admin/customers/${encodeURIComponent(customer.data.id)}`, { cookie: adminCookie });
    assert.equal(customerDetails.status, 200);
    assertNoStoredCredentials(customerDetails.data);
    assertNoStoredCredentials(customers.data);
    await page.goto(`${app.url}/admin/customers`);
    await page.getByRole("row").filter({ hasText: customer.data.email }).getByRole("button", { name: "View profile" }).click();
    await page.locator(".admin-customer-stat-grid article").first().waitFor();
    const customerStatContrast = await page.evaluate(() => {
        document.documentElement.classList.add("is-art-mode");
        const stat = document.querySelector(".admin-customer-stat-grid article");
        return {
            background: getComputedStyle(stat).backgroundColor,
            value: getComputedStyle(stat.querySelector("strong")).color,
        };
    });
    assert.equal(customerStatContrast.background, "rgb(255, 255, 255)", "customer stat card surfaces stay unchanged");
    assert.equal(customerStatContrast.value, "rgb(10, 12, 18)", "customer values remain visible on their existing white cards");
    await page.close();
});

test("legacy content without icon lists restores editable social and payment icons across the storefront", async (t) => {
    const app = await startTestApp({
        initialStore: {
            siteContent: {
                settings: { social: { facebook: "https://facebook.com/legacy-saltlyne" } },
            },
        },
    });
    t.after(() => app.close());
    const migratedContent = await apiRequest(app.apiUrl, "/store-content");
    assert.equal(migratedContent.data.settings.social.length, 6, "legacy social settings are upgraded to editable built-in entries");
    assert.equal(migratedContent.data.paymentIcons.length, 5, "missing payment settings receive editable built-in entries");
    assert.equal(migratedContent.data.settings.social.find((icon) => icon.key === "facebook").url, "https://facebook.com/legacy-saltlyne");
    const migratedStore = JSON.parse(await readFile(app.storeFile, "utf8"));
    assert.equal(migratedStore.siteContent.settings.social.length, 6, "the migrated social entries are persisted in backend storage");
    assert.equal(migratedStore.siteContent.paymentIcons.length, 5, "the migrated payment entries are persisted in backend storage");
    const page = await app.browser.newPage();
    await page.route("**/api/admin/store-content", async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        const response = await route.fetch();
        const content = await response.json();
        delete content.settings.social;
        delete content.paymentIcons;
        await route.fulfill({ response, json: content });
    });

    await page.goto(`${app.url}/admin/login`);
    await page.getByLabel("Password").fill("test-only-admin-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("heading", { name: "Good morning." }).waitFor();
    await page.goto(`${app.url}/admin/content`);
    await page.getByRole("heading", { name: "Edit storefront content" }).waitFor();
    await page.getByRole("tab", { name: "Social icons" }).click();
    await page.locator(".cms-icon-card").filter({ hasText: "Facebook" }).waitFor();
    assert.equal(await page.locator(".cms-icon-card").count(), 6, "all built-in social icons have editable backend entries when a legacy API omits the list");
    await page.locator(".cms-icon-card").filter({ hasText: "Facebook" }).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Social profile URL (HTTPS)").fill("https://facebook.com/saltlyne-runtime");
    await page.getByLabel("Upload icon image").setInputFiles({
        name: "social.png",
        mimeType: "image/png",
        buffer: await readFile(new URL("../../public/images/saltlyne-logo-black.png", import.meta.url)),
    });
    await page.getByRole("button", { name: "Use this crop" }).click();
    await page.getByRole("button", { name: "Save icon" }).click();
    await page.getByRole("button", { name: "Save and publish" }).click();
    await page.getByText("Store content saved and published.").waitFor();

    await page.getByRole("tab", { name: "Payment icons" }).click();
    await page.locator(".cms-icon-card").filter({ hasText: "Visa" }).waitFor();
    assert.equal(await page.locator(".cms-icon-card").count(), 5, "all built-in payment marks have editable backend entries");
    await page.locator(".cms-icon-card").filter({ hasText: "Visa" }).getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Payment information URL (HTTPS)").fill("https://www.visa.com/runtime-saltlyne");
    await page.getByLabel("Upload icon image").setInputFiles({
        name: "payment.png",
        mimeType: "image/png",
        buffer: await readFile(new URL("../../public/images/saltlyne-logo-black.png", import.meta.url)),
    });
    await page.getByRole("button", { name: "Use this crop" }).click();
    await page.getByRole("button", { name: "Save icon" }).click();
    await page.getByRole("button", { name: "Save and publish" }).click();
    await page.getByText("Store content saved and published.").waitFor();

    const saved = await apiRequest(app.apiUrl, "/store-content");
    const facebook = saved.data.settings.social.find((icon) => icon.key === "facebook");
    const visa = saved.data.paymentIcons.find((icon) => icon.key === "visa");
    assert.equal(facebook.url, "https://facebook.com/saltlyne-runtime");
    assert.match(facebook.image, /^data:image\/webp;base64,/);
    assert.equal(visa.url, "https://www.visa.com/runtime-saltlyne");
    assert.match(visa.image, /^data:image\/webp;base64,/);

    await page.route("**/api/store-content", async (route) => {
        const response = await route.fetch();
        const content = await response.json();
        delete content.settings.social;
        delete content.paymentIcons;
        await route.fulfill({ response, json: content });
    });
    await page.goto(app.url);
    const facebookMark = page.locator('[aria-label="Social media"] [data-icon-key="facebook"]');
    await facebookMark.waitFor();
    assert.equal(await facebookMark.evaluate((element) => Boolean(element.closest("a"))), false, "legacy fallback still renders social marks even when an old API response omits destination settings");
    await page.goto(`${app.url}/collections/women`);
    const visaMark = page.locator(".footer-payment-icons [data-icon-key='visa']");
    await visaMark.waitFor();
    assert.equal(await visaMark.evaluate((element) => Boolean(element.closest("a"))), false, "legacy fallback still renders payment marks when an old API response omits settings");
    await page.close();
});

test("publishing icon edits refreshes storefronts already open in another tab", async (t) => {
    const app = await startTestApp();
    t.after(() => app.close());
    const sharedContext = await app.browser.newContext();
    const storefront = await sharedContext.newPage();
    await storefront.goto(app.url);
    const facebook = storefront.locator('[aria-label="Social media"] [data-icon-key="facebook"]');
    await facebook.waitFor();
    assert.equal(await facebook.evaluate((element) => Boolean(element.closest("a"))), false);

    const admin = await sharedContext.newPage();
    await admin.goto(`${app.url}/admin/login`);
    await admin.getByLabel("Password").fill("test-only-admin-password");
    await admin.getByRole("button", { name: "Sign in" }).click();
    await admin.getByRole("heading", { name: "Good morning." }).waitFor();
    await admin.goto(`${app.url}/admin/content`);
    await admin.getByRole("heading", { name: "Edit storefront content" }).waitFor();
    await admin.getByRole("tab", { name: "Social icons" }).click();
    await admin.locator(".cms-icon-card").filter({ hasText: "Facebook" }).getByRole("button", { name: "Edit" }).click();
    await admin.getByLabel("Social profile URL (HTTPS)").fill("https://facebook.com/live-admin-update");
    await admin.getByRole("button", { name: "Save icon" }).click();
    await admin.getByRole("button", { name: "Save and publish" }).click();
    await admin.getByText(/Open storefront tabs have been refreshed/).waitFor();
    await storefront.waitForFunction(() =>
        document.querySelector('[aria-label="Social media"] [data-icon-key="facebook"]')?.closest("a")?.getAttribute("href") === "https://facebook.com/live-admin-update",
    );

    await storefront.goto(`${app.url}/collections/women`);
    const visa = storefront.locator(".footer-payment-icons [data-icon-key='visa']");
    await visa.waitFor();
    assert.equal(await visa.evaluate((element) => Boolean(element.closest("a"))), false);
    await admin.getByRole("tab", { name: "Payment icons" }).click();
    await admin.locator(".cms-icon-card").filter({ hasText: "Visa" }).getByRole("button", { name: "Edit" }).click();
    await admin.getByLabel("Payment information URL (HTTPS)").fill("https://visa.com/live-admin-update");
    await admin.getByRole("button", { name: "Save icon" }).click();
    await admin.getByRole("button", { name: "Save and publish" }).click();
    await storefront.waitForFunction(() =>
        document.querySelector(".footer-payment-icons [data-icon-key='visa']")?.closest("a")?.getAttribute("href") === "https://visa.com/live-admin-update",
    );

    const publicContent = await apiRequest(app.apiUrl, "/store-content");
    assert.equal(publicContent.data.settings.social.find((icon) => icon.key === "facebook").url, "https://facebook.com/live-admin-update");
    assert.equal(publicContent.data.paymentIcons.find((icon) => icon.key === "visa").url, "https://visa.com/live-admin-update");
    await admin.close();
    await storefront.close();
    await sharedContext.close();
});
