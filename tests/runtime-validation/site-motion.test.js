import assert from "node:assert/strict";
import test from "node:test";
import { startTestApp } from "./helpers.js";

test("storefront motion follows the light-mode orbit reference and respects reduced motion", async (t) => {
    const app = await startTestApp();
    t.after(() => app.close());
    const page = await app.browser.newPage();
    t.after(() => page.close());

    await page.goto(app.url);
    const home = page.locator(".saltlyne-store");
    await home.waitFor();
    const lightMotion = await home.evaluate((element) => ({
        background: getComputedStyle(element).backgroundImage,
        atmosphere: getComputedStyle(element).animationName,
        announcement: getComputedStyle(element.querySelector(".announcement")).backgroundImage,
    }));
    assert.match(lightMotion.background, /radial-gradient/, "light pages carry the soft blue and slate ambient glow");
    assert.equal(lightMotion.atmosphere, "saltlyne-light-orbit", "the ambient light drifts slowly behind the page");
    assert.match(lightMotion.announcement, /rgb\(2, 54, 97\)/, "storefront accents use the supplied navy palette");
    await page.locator(".campaign.aos-animate").waitFor();
    assert.equal(await page.locator(".newsletter").getAttribute("data-aos"), "fade-up", "the home page newsletter joins the scroll reveal");
    await page.locator(".newsletter").scrollIntoViewIfNeeded();
    await page.locator(".newsletter.aos-animate").waitFor();

    await page.evaluate(() => {
        document.documentElement.classList.add("is-art-mode");
        document.querySelector(".saltlyne-store").classList.add("is-art-mode");
    });
    const darkTheme = await home.evaluate((element) => ({
        atmosphere: getComputedStyle(element).animationName,
        paper: getComputedStyle(document.documentElement).getPropertyValue("--theme-paper").trim(),
        announcement: getComputedStyle(element.querySelector(".announcement")).backgroundImage,
    }));
    assert.equal(darkTheme.atmosphere, "none", "the light-mode atmosphere does not affect dark mode");
    assert.equal(darkTheme.paper, "#0A0C12", "Art Mode retains a distinct near-black foundation");
    assert.match(darkTheme.announcement, /rgb\(2, 54, 97\)/, "Art Mode keeps the same brand navy accent");

    await page.goto(`${app.url}/collections/women`);
    await page.evaluate(() => document.documentElement.classList.add("is-art-mode"));
    const shop = page.locator(".shop-page");
    await shop.waitFor();
    const collectionIntro = shop.locator(".shop-collection-intro[data-aos='fade-up']");
    await collectionIntro.waitFor();
    await page.locator(".shop-collection-intro.aos-animate").waitFor();
    const collectionCaption = page.locator(".shop-landing-collections .shop-landing-card-copy").first();
    await collectionCaption.waitFor();
    const collectionCardReadability = await collectionCaption.evaluate((element) => {
        const card = element.closest(".shop-landing-card");
        const caption = element.getBoundingClientRect();
        const bounds = card.getBoundingClientRect();
        return {
            background: getComputedStyle(element).backgroundColor,
            titleLineHeight: getComputedStyle(element.querySelector("strong")).lineHeight,
            titleFontSize: getComputedStyle(element.querySelector("strong")).fontSize,
            titleColor: getComputedStyle(element.querySelector("strong")).color,
            contained: caption.left >= bounds.left && caption.right <= bounds.right && caption.bottom <= bounds.bottom,
        };
    });

    assert.equal(collectionCardReadability.background, "rgba(0, 0, 0, 0)", "collection titles remain plain text without added boxes");
    assert.equal(collectionCardReadability.titleColor, "rgb(255, 255, 255)", "collection titles remain readable over the existing image shade");
    assert.ok(parseFloat(collectionCardReadability.titleLineHeight) >= parseFloat(collectionCardReadability.titleFontSize) * 1.19, "collection titles leave enough line height to keep descenders visible");
    assert.equal(collectionCardReadability.contained, true, "collection-card captions remain inside their image bounds");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`${app.url}/collections/women`);
    const reducedMotionStyle = await shop.evaluate((element) => ({
        animation: getComputedStyle(element).animationName,
        sectionOpacity: getComputedStyle(element.querySelector(".shop-collection-intro")).opacity,
    }));
    assert.equal(reducedMotionStyle.animation, "none", "ambient movement stops for reduced-motion preferences");
    assert.equal(reducedMotionStyle.sectionOpacity, "1", "content remains visible when reduced motion is enabled");
    assert.equal(await page.locator(".shop-product-card[data-aos]").count(), 0, "scroll animations are not installed for reduced-motion users");
});

test("Explore Stay tuned brings the newsletter signup into view and focuses its email field", async (t) => {
    const app = await startTestApp();
    t.after(() => app.close());
    const page = await app.browser.newPage({ viewport: { width: 390, height: 844 } });
    t.after(() => page.close());

    await page.goto(`${app.url}/explore`);
    await page.getByRole("link", { name: "Stay tuned" }).click();
    await page.waitForURL(/\/#newsletter$/);
    await page.waitForFunction(() => document.activeElement?.id === "email-address");
    await page.waitForFunction(() => {
        const bounds = document.getElementById("newsletter")?.getBoundingClientRect();
        return bounds && bounds.top < window.innerHeight && bounds.bottom > 0;
    });

    const newsletterState = await page.evaluate(() => ({
        focusedField: document.activeElement.id,
        emailType: document.activeElement.type,
    }));
    assert.equal(newsletterState.focusedField, "email-address", "the signup prompt places focus in the email field");
    assert.equal(newsletterState.emailType, "email", "the focused field accepts an email address");
});

test("the brand palette and glass surfaces carry through admin in light and Art Mode", async (t) => {
    const app = await startTestApp();
    t.after(() => app.close());
    const page = await app.browser.newPage({ viewport: { width: 390, height: 844 } });
    t.after(() => page.close());

    await page.goto(`${app.url}/admin/login`);
    const loginCard = page.locator(".admin-login-card");
    await loginCard.waitFor();
    const lightTheme = await page.evaluate(() => ({
        ink: getComputedStyle(document.documentElement).getPropertyValue("--theme-ink").trim(),
        navy: getComputedStyle(document.documentElement).getPropertyValue("--theme-navy").trim(),
        orange: getComputedStyle(document.documentElement).getPropertyValue("--theme-orange").trim(),
        cardBackground: getComputedStyle(document.querySelector(".admin-login-card")).backgroundColor,
        radius: getComputedStyle(document.querySelector(".admin-login-card")).borderRadius,
        blur: getComputedStyle(document.querySelector(".admin-login-card")).backdropFilter,
    }));
    assert.equal(lightTheme.ink, "#0A0C12");
    assert.equal(lightTheme.navy, "#023661");
    assert.equal(lightTheme.orange, "#DB5227");
    assert.equal(lightTheme.cardBackground, "rgba(255, 255, 255, 0.66)", "admin login uses the shared glass surface");
    assert.equal(lightTheme.radius, "13px", "glass surfaces retain consistent rounded geometry on mobile");
    assert.match(lightTheme.blur, /blur\(12px\)/, "mobile backend surfaces use the glass blur");

    await page.evaluate(() => document.documentElement.classList.add("is-art-mode"));
    const darkTheme = await page.evaluate(() => ({
        paper: getComputedStyle(document.documentElement).getPropertyValue("--theme-paper").trim(),
        cardBackground: getComputedStyle(document.querySelector(".admin-login-card")).backgroundColor,
        cardColor: getComputedStyle(document.querySelector(".admin-login-card")).color,
        buttonBackground: getComputedStyle(document.querySelector(".admin-login-card .admin-primary")).backgroundImage,
    }));
    assert.equal(darkTheme.paper, "#0A0C12", "Art Mode stays distinctly dark using the brand near-black");
    assert.equal(darkTheme.cardBackground, "rgba(17, 26, 38, 0.72)", "Art Mode uses a dark glass surface");
    assert.equal(darkTheme.cardColor, "rgb(244, 246, 250)", "dark glass content remains legible");
    assert.match(darkTheme.buttonBackground, /rgb\(219, 82, 39\)/, "the orange accent remains consistent in Art Mode");
});

test("the homepage header is transparent over the hero and reveals flat glass on hover in both modes", async (t) => {
    const app = await startTestApp();
    t.after(() => app.close());
    const page = await app.browser.newPage({ viewport: { width: 1440, height: 900 } });
    t.after(() => page.close());

    await page.goto(app.url);
    const header = page.locator(".store-header");
    await header.waitFor({ state: "attached" });
    const heroLight = await header.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        visibility: getComputedStyle(element).visibility,
        radius: getComputedStyle(element).borderRadius,
    }));
    assert.equal(heroLight.visibility, "visible", "the header remains visible over the hero");
    assert.equal(heroLight.background, "rgba(0, 0, 0, 0)", "the header stays transparent over the hero");
    assert.equal(heroLight.radius, "0px", "the header keeps square corners");

    await page.locator(".logo-menu-trigger").hover();
    await page.waitForTimeout(250);
    const hoveredLight = await header.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        radius: getComputedStyle(element).borderRadius,
    }));
    assert.equal(hoveredLight.background, "rgba(255, 255, 255, 0.66)", "hover reveals the glass bar over the hero");
    assert.equal(hoveredLight.radius, "0px", "the hovered bar has no rounded corners");
    await page.mouse.move(0, 0);

    await page.evaluate(() => {
        const track = document.querySelector(".campaign-scroll-track");
        const headerHeight = document.querySelector(".store-header-shell").getBoundingClientRect().height;
        const trackBottom = track.getBoundingClientRect().bottom + window.scrollY;
        window.scrollTo(0, trackBottom - headerHeight + 2);
    });
    await page.waitForFunction(() => document.querySelector(".store-header-shell")?.classList.contains("is-past-hero"));
    const returnedLight = await header.evaluate((element) => ({
        visibility: getComputedStyle(element).visibility,
        background: getComputedStyle(element).backgroundColor,
        radius: getComputedStyle(element).borderRadius,
    }));
    assert.equal(returnedLight.visibility, "visible", "the header stays visible after the hero");
    assert.equal(returnedLight.background, "rgba(255, 255, 255, 0.66)", "after the hero, the light-mode glass surface remains visible");
    assert.equal(returnedLight.radius, "0px", "the returned header has no rounded corners");

    await page.evaluate(() => {
        document.documentElement.classList.add("is-art-mode");
        document.querySelector(".saltlyne-store").classList.add("is-art-mode");
        window.scrollTo(0, 0);
    });
    await page.waitForFunction(() => document.querySelector(".store-header-shell")?.classList.contains("is-over-hero"));
    await page.mouse.move(0, 200);
    await page.waitForTimeout(250);
    const heroDark = await header.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        visibility: getComputedStyle(element).visibility,
        radius: getComputedStyle(element).borderRadius,
    }));
    assert.equal(heroDark.visibility, "visible", "the Art Mode header also remains visible over the hero");
    assert.equal(heroDark.background, "rgba(0, 0, 0, 0)", "Art Mode stays transparent over the hero");
    assert.equal(heroDark.radius, "0px", "Art Mode header stays square-cornered");
    await page.locator(".logo-menu-trigger").hover();
    await page.waitForTimeout(250);
    const hoveredDark = await header.evaluate((element) => getComputedStyle(element).backgroundColor);
    assert.ok(Math.abs(parseFloat(hoveredDark.split(",").at(-1)) - .72) < .01, "hover reveals dark glass over the hero");
    await page.mouse.move(0, 0);

    await page.evaluate(() => {
        const track = document.querySelector(".campaign-scroll-track");
        const headerHeight = document.querySelector(".store-header-shell").getBoundingClientRect().height;
        const trackBottom = track.getBoundingClientRect().bottom + window.scrollY;
        window.scrollTo(0, trackBottom - headerHeight + 2);
    });
    await page.waitForFunction(() => document.querySelector(".store-header-shell")?.classList.contains("is-past-hero"));
    const returnedDark = await header.evaluate((element) => ({
        visibility: getComputedStyle(element).visibility,
        background: getComputedStyle(element).backgroundColor,
        radius: getComputedStyle(element).borderRadius,
    }));
    assert.equal(returnedDark.visibility, "visible", "the Art Mode header remains visible after the hero");
    assert.ok(Math.abs(parseFloat(returnedDark.background.split(",").at(-1)) - .72) < .01, "the returned Art Mode header uses dark glass");
    assert.equal(returnedDark.radius, "0px", "the Art Mode header remains square-cornered");
});

test("Explore uses readable glass surfaces without washing out its photography", async (t) => {
    const app = await startTestApp();
    t.after(() => app.close());
    const page = await app.browser.newPage({ viewport: { width: 390, height: 844 } });
    t.after(() => page.close());

    await page.goto(`${app.url}/explore`);
    const dropCopy = page.locator(".explore-drop-copy").first();
    await dropCopy.waitFor();
    const lightExplore = await page.evaluate(() => ({
        dropRadius: getComputedStyle(document.querySelector(".explore-drop")).borderRadius,
        imageFilter: getComputedStyle(document.querySelector(".explore-drop-media")).filter,
        copyBackground: getComputedStyle(document.querySelector(".explore-drop-copy")).backgroundColor,
        titleColor: getComputedStyle(document.querySelector(".explore-drop-copy h1")).color,
        copyBlur: getComputedStyle(document.querySelector(".explore-drop-copy")).backdropFilter,
        copyShadow: getComputedStyle(document.querySelector(".explore-drop-copy")).boxShadow,
        titleLinkBackground: getComputedStyle(document.querySelector(".explore-drop-title-link")).backgroundColor,
        titleLinkDisplay: getComputedStyle(document.querySelector(".explore-drop-title-link")).display,
        kickerColor: getComputedStyle(document.querySelector(".explore-drop-copy p")).color,
        countdownBackground: getComputedStyle(document.querySelector(".new-collection-countdown-unit")).backgroundColor,
    }));
    assert.equal(lightExplore.dropRadius, "17px", "Explore cards have the rounded glass-deck treatment on mobile");
    assert.equal(lightExplore.imageFilter, "none", "glass overlays preserve crisp card photography");
    assert.equal(lightExplore.copyBackground, "rgba(0, 0, 0, 0)", "photo captions have no extra box");
    assert.equal(lightExplore.copyShadow, "none", "photo captions have no box shadow");
    assert.equal(lightExplore.titleColor, "rgb(255, 255, 255)", "Explore photo titles remain high contrast");
    assert.equal(lightExplore.titleLinkBackground, "rgba(0, 0, 0, 0)", "the linked title is not rendered as a low-contrast button");
    assert.equal(lightExplore.titleLinkDisplay, "inline", "the title link retains normal heading layout");
    assert.equal(lightExplore.copyBlur, "none", "photo captions do not add a glass box blur");
    assert.equal(lightExplore.kickerColor, "rgb(244, 246, 250)", "Explore category labels remain readable over the existing image shade");
    assert.equal(lightExplore.countdownBackground, "rgba(255, 255, 255, 0.72)", "countdown values use light glass tiles");
    await page.locator(".explore-drop-title-link").first().hover();
    assert.equal(await page.locator(".explore-drop-title-link").first().evaluate((element) => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)", "hovering a card title does not add a green or white button background");

    await page.evaluate(() => document.documentElement.classList.add("is-art-mode"));
    const darkExplore = await page.evaluate(() => ({
        copyBackground: getComputedStyle(document.querySelector(".explore-drop-copy")).backgroundColor,
        copyText: getComputedStyle(document.querySelector(".explore-drop-copy p")).color,
        countdownBackground: getComputedStyle(document.querySelector(".new-collection-countdown-unit")).backgroundColor,
        countdownText: getComputedStyle(document.querySelector(".new-collection-countdown-unit > span")).color,
    }));
    assert.equal(darkExplore.copyBackground, "rgba(0, 0, 0, 0)", "Art Mode keeps captions free of extra boxes");
    assert.equal(darkExplore.copyText, "rgb(216, 224, 232)", "Art Mode keeps supporting Explore text readable");
    assert.equal(darkExplore.countdownBackground, "rgba(17, 26, 38, 0.82)", "countdown tiles switch to dark glass");
    assert.equal(darkExplore.countdownText, "rgb(244, 246, 250)", "countdown digits remain legible in Art Mode");
});

test("storefront newsletter, footer, and long collection titles stay readable in both themes", async (t) => {
    const app = await startTestApp();
    t.after(() => app.close());
    const page = await app.browser.newPage({ viewport: { width: 390, height: 844 } });
    t.after(() => page.close());

    await page.goto(app.url);
    const newsletter = page.locator(".newsletter form");
    await newsletter.waitFor();
    const lightMode = await page.evaluate(() => {
        const form = document.querySelector(".newsletter form");
        const input = form.querySelector("#email-address");
        const consent = form.querySelector(".newsletter-consent");
        const checkbox = consent.querySelector("input");
        const button = form.querySelector("button");
        const link = document.querySelector(".footer-link-columns a");
        const heading = document.querySelector(".footer-link-columns h2");
        const footer = document.querySelector(".footer-brand-row");
        return {
            formBackground: getComputedStyle(form).backgroundColor,
            formShadow: getComputedStyle(form).boxShadow,
            inputHeight: getComputedStyle(input).height,
            inputBackground: getComputedStyle(input).backgroundColor,
            buttonBackground: getComputedStyle(button).backgroundColor,
            buttonHeight: getComputedStyle(button).height,
            consentSize: getComputedStyle(checkbox).width,
            consentFontSize: getComputedStyle(consent).fontSize,
            footerLinkColor: getComputedStyle(link).color,
            footerHeadingColor: getComputedStyle(heading).color,
            newsletterButtonColor: getComputedStyle(button).color,
            footerTaglineColor: getComputedStyle(footer.querySelector("span")).color,
            footerCopyrightColor: getComputedStyle(footer.querySelector(":scope > small")).color,
            footerLogoFilter: getComputedStyle(footer.querySelector(".brand-logo-image")).filter,
            footerRule: getComputedStyle(footer).borderTopColor,
        };
    });
    assert.equal(lightMode.formBackground, "rgba(0, 0, 0, 0)", "the newsletter keeps a simple, unboxed form");
    assert.equal(lightMode.formShadow, "none", "the newsletter form avoids a heavy panel shadow");
    assert.equal(lightMode.inputHeight, "44px", "the email field has a comfortable tap target");
    assert.equal(lightMode.inputBackground, "rgba(0, 0, 0, 0)", "the email field remains visually light");
    assert.equal(lightMode.buttonBackground, "rgb(219, 82, 39)", "the subscribe action uses the orange brand accent");
    assert.equal(lightMode.newsletterButtonColor, "rgb(255, 255, 255)", "the orange subscribe action has readable text");
    assert.equal(lightMode.buttonHeight, "44px", "the subscribe action aligns with the email field");
    assert.equal(lightMode.consentSize, "16px", "the consent checkbox is large enough to see and use");
    assert.equal(lightMode.consentFontSize, "10px", "the consent copy remains readable at mobile width");
    assert.equal(lightMode.footerLinkColor, "rgb(63, 75, 89)", "light footer links use a dark readable ink");
    assert.equal(lightMode.footerHeadingColor, "rgb(10, 12, 18)", "light footer headings use the brand ink");
    assert.equal(lightMode.footerTaglineColor, "rgb(10, 12, 18)", "the light footer tagline uses readable brand ink");
    assert.equal(lightMode.footerCopyrightColor, "rgb(89, 106, 121)", "the light footer copyright remains legible");
    assert.equal(lightMode.footerLogoFilter, "none", "the light footer logo is not inverted on a light surface");
    assert.notEqual(lightMode.footerRule, "rgba(0, 0, 0, 0)", "the footer brand strip has a visible divider");

    await page.evaluate(() => {
        document.documentElement.classList.add("is-art-mode");
        document.querySelector(".saltlyne-store").classList.add("is-art-mode");
    });
    const darkMode = await page.evaluate(() => ({
        newsletterButtonColor: getComputedStyle(document.querySelector(".newsletter form button")).color,
        newsletterButtonBackground: getComputedStyle(document.querySelector(".newsletter form button")).backgroundColor,
        footerHeadingColor: getComputedStyle(document.querySelector(".footer-link-columns h2")).color,
        footerTaglineColor: getComputedStyle(document.querySelector(".footer-brand-row > span")).color,
    }));
    assert.equal(darkMode.newsletterButtonColor, "rgb(255, 255, 255)", "the orange newsletter action stays visible in Art Mode");
    assert.equal(darkMode.newsletterButtonBackground, "rgb(219, 82, 39)", "the subscribe action keeps its orange accent in Art Mode");
    assert.equal(darkMode.footerHeadingColor, "rgb(255, 255, 255)", "dark footer headings remain light");
    assert.equal(darkMode.footerTaglineColor, "rgb(243, 241, 251)", "the dark footer tagline remains high contrast");

    await page.goto(`${app.url}/collections/women`);
    const longTitle = page.locator(".shop-landing-collections .shop-landing-card-copy strong").first();
    await longTitle.waitFor();
    const collectionReadability = await longTitle.evaluate((title) => {
        const card = title.closest(".shop-landing-card");
        const titleBounds = title.getBoundingClientRect();
        const cardBounds = card.getBoundingClientRect();
        return {
            text: title.textContent,
            fontSize: getComputedStyle(title).fontSize,
            titleBackground: getComputedStyle(title).backgroundColor,
            titleLineHeight: getComputedStyle(title).lineHeight,
            copyBackground: getComputedStyle(title.parentElement).backgroundColor,
            copyShadow: getComputedStyle(title.parentElement).boxShadow,
            imageBottom: card.querySelector("img").getBoundingClientRect().bottom,
            titleTop: title.getBoundingClientRect().top,
            cardBackground: getComputedStyle(card).backgroundColor,
            imageClip: getComputedStyle(card.querySelector("img")).clipPath,
            editorialPaddingLeft: getComputedStyle(document.querySelector(".collection-landing-editorial")).paddingLeft,
            fits: titleBounds.left >= cardBounds.left && titleBounds.right <= cardBounds.right
                && titleBounds.bottom <= cardBounds.bottom
                && title.scrollWidth <= title.clientWidth + 1,
        };
    });
    assert.equal(collectionReadability.text, "Megan Thee Stallion Does Gym");
    assert.equal(collectionReadability.titleBackground, "rgba(0, 0, 0, 0)", "category titles have no label boxes");
    assert.ok(parseFloat(collectionReadability.titleLineHeight) >= parseFloat(collectionReadability.fontSize) * 1.19, "category title line boxes leave room for descenders");
    assert.equal(collectionReadability.copyBackground, "rgba(0, 0, 0, 0)", "category captions stay directly over the image");
    assert.equal(collectionReadability.copyShadow, "none", "category captions do not gain a box shadow");
    assert.ok(collectionReadability.titleTop > collectionReadability.imageBottom, "category labels sit below and apart from the image");
    assert.equal(collectionReadability.cardBackground, "rgba(0, 0, 0, 0)", "the label area remains transparent");
    assert.equal(collectionReadability.imageClip, "inset(0px)", "hover zoom stays clipped to the image tile only");
    assert.ok(parseFloat(collectionReadability.editorialPaddingLeft) >= 18, "editorial copy keeps a clear inset from the panel edge");
    assert.equal(collectionReadability.fits, true, "long category titles wrap inside their card on mobile");

    await page.evaluate(() => {
        document.documentElement.classList.add("is-art-mode");
        document.querySelector(".shop-page").classList.add("is-art-mode");
    });
    const darkCardTitle = await longTitle.evaluate((title) => ({
        color: getComputedStyle(title).color,
        lineHeight: getComputedStyle(title).lineHeight,
        fontSize: getComputedStyle(title).fontSize,
    }));
    assert.equal(darkCardTitle.color, "rgb(255, 255, 255)", "Art Mode category titles remain clearly visible");
    assert.ok(parseFloat(darkCardTitle.lineHeight) >= parseFloat(darkCardTitle.fontSize) * 1.19, "Art Mode titles retain descender clearance");

    const artFooterCard = await page.locator(".landing-footer-card-mark").first().evaluate((element) => ({
        background: getComputedStyle(element).backgroundImage,
        textColor: getComputedStyle(element).color,
        cardText: getComputedStyle(element.closest(".landing-footer-card")).color,
    }));
    assert.match(artFooterCard.background, /rgb\(10, 12, 18\).*rgb\(2, 54, 97\)/, "Art Mode footer accents stay within the brand palette");
    assert.equal(artFooterCard.textColor, "rgb(196, 210, 223)", "Art Mode footer accents retain clear contrast");
    assert.equal(artFooterCard.cardText, "rgb(230, 224, 239)", "Art Mode footer cards keep readable text");
});
