import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { startTestApp } from "./helpers.js";

test("customer auth, profile and address changes persist and render in the account portal", async (t) => {
    const app = await startTestApp();
    t.after(() => app.close());
    const page = await app.browser.newPage();
    t.after(() => page.close());
    const email = `account-${Date.now()}@example.test`;
    const password = "Runtime-Test-Password-482!";

    await page.goto(`${app.url}/account`);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill("incorrect-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await assert.doesNotReject(() => page.getByRole("alert").getByText("Email or password is incorrect.").waitFor());

    await page.getByRole("button", { name: "New to Saltlyne? Create an account" }).click();
    await page.getByLabel("First name").fill("Sithum");
    await page.getByLabel("Last name").fill("Peiris");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByText("Everything in one place.").waitFor();
    const accountBadge = page.locator(".account-mark");
    assert.equal(await accountBadge.textContent(), "SP", "the account welcome badge shows both customer initials");
    const lightAccountBadge = await accountBadge.evaluate((element) => ({
        color: getComputedStyle(element).color,
        animation: getComputedStyle(element, "::before").animationName,
        width: getComputedStyle(element).width,
        height: getComputedStyle(element).height,
    }));
    assert.equal(lightAccountBadge.color, "rgb(17, 17, 17)");
    assert.equal(lightAccountBadge.animation, "account-orb-swirl");
    assert.equal(lightAccountBadge.width, "62px");
    assert.equal(lightAccountBadge.height, "62px");
    await page.goto(app.url);
    const accountLink = page.getByRole("link", { name: "Account, Sithum Peiris" });
    await accountLink.waitFor();
    const initials = accountLink.getByText("SP", { exact: true });
    await initials.waitFor();
    const desktopBounds = await initials.boundingBox();
    assert.ok(desktopBounds && Math.abs(desktopBounds.width - 27) <= 1 && Math.abs(desktopBounds.height - 27) <= 1, "desktop initials retain the original account-icon proportions");
    assert.equal(await initials.evaluate((element) => getComputedStyle(element).viewTransitionName), "saltlyne-profile-badge");
    const lightModeAppearance = await initials.evaluate((element) => ({
        color: getComputedStyle(element).color,
        animation: getComputedStyle(element, "::before").animationName,
    }));
    assert.equal(lightModeAppearance.color, "rgb(17, 17, 17)", "light mode uses black initials");
    assert.equal(lightModeAppearance.animation, "account-orb-swirl", "the light-mode orb animates");
    await page.getByRole("switch", { name: "Turn on Art Mode" }).click();
    const darkModeColors = await initials.evaluate((element) => {
        const style = getComputedStyle(element);
        return { color: style.color, animation: getComputedStyle(element, "::before").animationName };
    });
    assert.equal(darkModeColors.color, "rgb(255, 255, 255)", "dark mode uses white initials");
    assert.equal(darkModeColors.animation, "account-orb-swirl", "the dark-mode orb animates");
    const artModeBounds = await initials.boundingBox();
    assert.deepEqual({ width: artModeBounds.width, height: artModeBounds.height }, { width: desktopBounds.width, height: desktopBounds.height });
    await page.setViewportSize({ width: 375, height: 812 });
    const mobileBounds = await initials.boundingBox();
    assert.ok(mobileBounds && Math.abs(mobileBounds.width - 27) <= 1 && Math.abs(mobileBounds.height - 27) <= 1, "mobile initials preserve the original icon proportions");
    await accountLink.click();
    const destinationAccountBadge = page.locator(".account-mark");
    await destinationAccountBadge.waitFor();
    assert.equal(await destinationAccountBadge.textContent(), "SP", "the destination badge is present immediately for the shared-element transition");
    assert.equal(await destinationAccountBadge.evaluate((element) => getComputedStyle(element).viewTransitionName), "saltlyne-profile-badge");
    const transitionPseudoElements = await page.evaluate(() => document.getAnimations({ subtree: true })
        .map((animation) => animation.effect?.pseudoElement)
        .filter(Boolean));
    assert.ok(transitionPseudoElements.includes("::view-transition-group(saltlyne-profile-badge)"), "the browser animates the shared badge between its source and destination");
    assert.ok(transitionPseudoElements.includes("::view-transition-new(account-page-content)"), "the account content fades in during navigation");
    const badgeOverlayStyles = await page.evaluate(() => ({
        zIndex: getComputedStyle(document.documentElement, "::view-transition-group(saltlyne-profile-badge)").zIndex,
        overflow: getComputedStyle(document.documentElement, "::view-transition-image-pair(saltlyne-profile-badge)").overflow,
        energyAnimation: getComputedStyle(document.documentElement, "::view-transition-image-pair(saltlyne-profile-badge)").animationName,
    }));
    assert.equal(badgeOverlayStyles.zIndex, "9999", "the moving badge stays above page content");
    assert.equal(badgeOverlayStyles.overflow, "visible", "destination layout does not clip the moving badge");
    assert.equal(badgeOverlayStyles.energyAnimation, "account-badge-energy", "the badge overlay gets a futuristic energy pulse");
    const badgeFlightDuration = await page.evaluate(() => getComputedStyle(document.documentElement, "::view-transition-group(saltlyne-profile-badge)").animationDuration);
    assert.equal(badgeFlightDuration, "1.8s", "badge movement is deliberately slow");
    const darkAccountBadge = await page.locator(".account-mark").evaluate((element) => ({
        color: getComputedStyle(element).color,
        animation: getComputedStyle(element, "::before").animationName,
        background: getComputedStyle(element).backgroundImage,
    }));
    assert.equal(darkAccountBadge.color, "rgb(255, 255, 255)");
    assert.equal(darkAccountBadge.animation, "account-orb-swirl");
    assert.match(darkAccountBadge.background, /rgb\(25, 44, 128\)/, "the account welcome badge uses the dark-mode orb");
    await page.getByRole("link", { name: "Profile" }).click();
    await page.getByLabel("First name").waitFor();
    const darkProfile = await page.evaluate(() => ({
        pageBackground: getComputedStyle(document.querySelector(".account-page")).backgroundColor,
        formBackground: getComputedStyle(document.querySelector(".account-profile-forms .checkout-form")).backgroundColor,
        headingColor: getComputedStyle(document.querySelector(".account-content > h1")).color,
        formHeadingColor: getComputedStyle(document.querySelector(".account-profile-forms .checkout-form h2")).color,
        formKickerColor: getComputedStyle(document.querySelector(".account-profile-forms .account-kicker")).color,
        fieldLabelColor: getComputedStyle(document.querySelector(".account-profile-forms label")).color,
        fieldColor: getComputedStyle(document.querySelector('[name="firstName"]')).color,
        fieldBackground: getComputedStyle(document.querySelector('[name="firstName"]')).backgroundColor,
    }));
    assert.equal(darkProfile.pageBackground, "rgb(10, 12, 18)");
    assert.equal(darkProfile.formBackground, "rgba(18, 29, 43, 0.94)");
    assert.equal(darkProfile.headingColor, "rgb(243, 241, 251)");
    assert.equal(darkProfile.formHeadingColor, "rgb(244, 246, 250)");
    assert.equal(darkProfile.formKickerColor, "rgb(169, 201, 228)");
    assert.equal(darkProfile.fieldLabelColor, "rgb(216, 224, 232)");
    assert.equal(darkProfile.fieldColor, "rgb(244, 246, 250)");
    assert.equal(darkProfile.fieldBackground, "rgb(10, 12, 18)");
    await page.goto(app.url);
    await page.getByRole("switch", { name: "Turn off Art Mode" }).click();
    await page.goto(`${app.url}/account/profile`);
    await page.getByLabel("First name").waitFor();
    const lightProfile = await page.evaluate(() => ({
        pageBackground: getComputedStyle(document.querySelector(".account-page")).backgroundColor,
        formBackground: getComputedStyle(document.querySelector(".account-profile-forms .checkout-form")).backgroundColor,
        headingColor: getComputedStyle(document.querySelector(".account-profile-forms .checkout-form h2")).color,
        kickerColor: getComputedStyle(document.querySelector(".account-profile-forms .account-kicker")).color,
        labelColor: getComputedStyle(document.querySelector(".account-profile-forms label")).color,
        fieldColor: getComputedStyle(document.querySelector('[name="firstName"]')).color,
        fieldBackground: getComputedStyle(document.querySelector('[name="firstName"]')).backgroundColor,
    }));
    assert.equal(lightProfile.pageBackground, "rgb(243, 245, 247)");
    assert.equal(lightProfile.formBackground, "rgba(255, 255, 255, 0.92)");
    assert.equal(lightProfile.headingColor, "rgb(10, 12, 18)");
    assert.equal(lightProfile.kickerColor, "rgb(2, 54, 97)");
    assert.equal(lightProfile.labelColor, "rgb(63, 58, 66)");
    assert.equal(lightProfile.fieldColor, "rgb(10, 12, 18)");
    assert.equal(lightProfile.fieldBackground, "rgb(255, 255, 255)");
    await page.getByRole("link", { name: "Overview" }).click();
    await page.getByText("Everything in one place.").waitFor();
    await page.getByRole("link", { name: "← Back to Saltlyne" }).click();
    const returnedAccountLink = page.getByRole("link", { name: "Account, Sithum Peiris" });
    await returnedAccountLink.waitFor();
    assert.equal(await returnedAccountLink.getByText("SP", { exact: true }).count(), 1, "the reverse transition has the customer initials ready at its destination");
    const reverseTransitionAnimations = await page.evaluate(() => document.getAnimations({ subtree: true })
        .map((animation) => animation.effect?.pseudoElement)
        .filter(Boolean));
    assert.ok(reverseTransitionAnimations.includes("::view-transition-group(saltlyne-profile-badge)"), "the badge transitions back to the homepage");
    assert.ok(reverseTransitionAnimations.includes("::view-transition-new(home-page-content)"), "homepage content fades in on return");
    assert.ok(reverseTransitionAnimations.includes("::view-transition-old(account-page-content)"), "account content fades out on return");
    await returnedAccountLink.click();
    await page.getByRole("link", { name: "Profile" }).click();
    await page.getByLabel("First name").waitFor();
    await page.getByLabel("First name").fill("Updated");
    await page.getByLabel("Last name").fill("Runtime Customer");
    await page.getByLabel("Phone number").fill("+1 555 0100");
    await page.getByRole("button", { name: "Save profile" }).click();
    await page.getByRole("status").getByText("Your profile has been updated.").waitFor();

    await page.getByRole("link", { name: "Addresses" }).click();
    await page.getByRole("button", { name: "Add address +" }).click();
    await page.getByLabel("Address label").fill("Test home");
    await page.getByLabel("Street address").fill("123 Example Street");
    await page.getByLabel("City").fill("Test City");
    await page.getByLabel("Country").fill("Test Country");
    await page.getByRole("button", { name: "Save address" }).click();
    await page.getByText("Test home").waitFor();
    await page.reload();
    await page.getByText("Test home").waitFor();

    const store = JSON.parse(await readFile(app.storeFile, "utf8"));
    const savedCustomer = store.customers.find((customer) => customer.email === email);
    assert.ok(savedCustomer, "customer registration is persisted");
    assert.equal(savedCustomer.name, "Updated Runtime Customer");
    assert.equal(savedCustomer.firstName, "Updated");
    assert.equal(savedCustomer.lastName, "Runtime Customer");
    assert.equal(savedCustomer.phone, "+1 555 0100");
    assert.equal(savedCustomer.addresses[0].line1, "123 Example Street");
    assert.equal(savedCustomer.lastLoginAt !== null, true);
    assert.equal("cardNumber" in savedCustomer, false);
    assert.equal("cvv" in savedCustomer, false);
    assert.match(app.logs(), /Saltlyne server listening/);
});
