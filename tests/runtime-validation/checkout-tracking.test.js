import assert from "node:assert/strict";
import test from "node:test";
import { apiRequest, startTestApp } from "./helpers.js";

test("guest checkout creates a persisted order that the tracking page can retrieve", async (t) => {
    const app = await startTestApp();
    t.after(() => app.close());
    const page = await app.browser.newPage();

    const protectedAccount = await apiRequest(app.apiUrl, "/account/orders");
    assert.equal(protectedAccount.status, 401, "customer order history requires sign-in");

    const productResponse = await apiRequest(app.apiUrl, "/products");
    const product = productResponse.data.find((item) => item.active && item.stock > 0);
    assert.ok(product, "the storefront has an active, in-stock product");
    const email = `order-${Date.now()}@example.test`;
    const placed = await apiRequest(app.apiUrl, "/orders", {
        method: "POST",
        body: {
            email,
            name: "Runtime Order Customer",
            address: "123 Example Street, Test City",
            items: [{ id: product.id, quantity: 1 }],
            currency: "USD",
            paymentMethod: "cash_on_delivery",
        },
    });
    assert.equal(placed.status, 201, JSON.stringify(placed.data));
    assert.ok(placed.data.id);

    await page.goto(`${app.url}/orders/track?orderId=${encodeURIComponent(placed.data.id)}`);
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Find order" }).click();
    await page.getByRole("heading", { name: "pending" }).waitFor();
    await page.getByText(placed.data.id).waitFor();
    await page.getByText(product.name).waitFor();

    const tracked = await apiRequest(app.apiUrl, "/orders/track", {
        method: "POST",
        body: { orderId: placed.data.id, email },
    });
    assert.equal(tracked.status, 200);
    assert.equal(tracked.data.customer, undefined, "public order tracking omits customer contact details");
    assert.equal(tracked.data.items[0].id, product.id);
    const adminLogin = await apiRequest(app.apiUrl, "/auth/login", {
        method: "POST",
        body: { email: "owner@saltlynelabel.com", password: "test-only-admin-password" },
    });
    const adminOrders = await apiRequest(app.apiUrl, "/admin/orders", { cookie: adminLogin.cookie });
    assert.ok(adminOrders.data.some((order) => order.id === placed.data.id), "the same order is manageable in admin");
    await page.close();
});
