import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { api } from "../../lib/api";
import { useStoreContent } from "../../lib/useStoreContent";
import ProfileBadge from "../../components/ProfileBadge";
import "./style.css";

const accountLinks = [
    ["/account", "Overview"],
    ["/account/orders", "Orders"],
    ["/account/rewards", "Rewards & discounts"],
    ["/account/addresses", "Addresses"],
    ["/account/profile", "Profile"],
    ["/account/payment-methods", "Payment methods"],
];

function money(value, currency = "USD") {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value) || 0);
}

export default function Account() {
    const { content: storeContent } = useStoreContent();
    const location = useLocation();
    const navigate = useNavigate();
    const page = location.pathname.split("/")[2] || "overview";
    const resetQuery = new URLSearchParams(location.search);
    const resetToken = resetQuery.get("token") || "";
    const resetComplete = resetQuery.get("complete") === "1";
    const initialCustomer = location.state?.customer || null;
    const [customer, setCustomer] = useState(initialCustomer);
    const [orders, setOrders] = useState([]);
    const [rewards, setRewards] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [addressDraft, setAddressDraft] = useState(null);
    const [registering, setRegistering] = useState(false);
    const [loading, setLoading] = useState(!initialCustomer);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function loadAccount(user) {
        const [orderRows, rewardData] = await Promise.all([api("/account/orders"), api("/account/rewards")]);
        setCustomer(user);
        setAddresses(user.addresses || []);
        setOrders(orderRows);
        setRewards(rewardData);
    }

    useEffect(() => {
        api("/account/me").then(loadAccount).catch((reason) => {
            if (reason.message !== "Sign in required.") setError(reason.message);
        }).finally(() => setLoading(false));
    }, []);

    async function submitAuth(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        const details = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
            const user = await api(`/account/${registering ? "register" : "login"}`, { method: "POST", body: JSON.stringify(details) });
            await loadAccount(user);
            setNotice(registering ? "Your account is ready." : "");
        } catch (reason) { setError(reason.message); }
        finally { setBusy(false); }
    }

    async function updateProfile(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        try {
            setCustomer(await api("/account/profile", { method: "PATCH", body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) }));
            setNotice("Your profile has been updated.");
        } catch (reason) { setError(reason.message); }
        finally { setBusy(false); }
    }

    async function updatePassword(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        const form = event.currentTarget;
        try {
            await api("/account/password", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
            form.reset();
            setNotice("Your password has been updated.");
        } catch (reason) { setError(reason.message); }
        finally { setBusy(false); }
    }

    async function saveAddresses(nextAddresses) {
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const result = await api("/account/addresses", { method: "PUT", body: JSON.stringify({ addresses: nextAddresses }) });
            setAddresses(result.addresses);
            setCustomer((current) => ({ ...current, addresses: result.addresses }));
            setAddressDraft(null);
            setNotice("Your address book has been updated.");
        } catch (reason) { setError(reason.message); }
        finally { setBusy(false); }
    }

    async function signOut() {
        setError("");
        try {
            await api("/account/logout", { method: "POST" });
            setCustomer(null);
            setOrders([]);
            setRewards(null);
            setAddresses([]);
            setNotice("");
        } catch (reason) { setError(reason.message); }
    }

    const productsPurchased = useMemo(() => {
        const seen = new Set();
        return orders.flatMap((order) => (order.items || []).filter((item) => {
            const key = `${item.id}:${item.size || ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }));
    }, [orders]);
    const pageTitle = {
        overview: "Your account",
        orders: "Your orders",
        rewards: "Rewards & discounts",
        addresses: "Your addresses",
        profile: "Profile settings",
        "payment-methods": "Payment methods",
        "forgot-password": "Reset your password",
        "reset-password": "Choose a new password",
    }[page] || "Your account";

    async function requestPasswordReset(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        const form = event.currentTarget;
        try {
            const result = await api("/account/password-reset/request", {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
            });
            form.reset();
            setNotice(result.message);
        } catch (reason) { setError(reason.message); }
        finally { setBusy(false); }
    }

    async function completePasswordReset(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setNotice("");
        const form = event.currentTarget;
        const details = Object.fromEntries(new FormData(form).entries());
        if (details.password !== details.confirmPassword) {
            setError("The passwords do not match.");
            setBusy(false);
            return;
        }
        try {
            await api("/account/password-reset/complete", {
                method: "POST",
                body: JSON.stringify({ token: resetToken, password: details.password }),
            });
            form.reset();
            navigate("/account/reset-password?complete=1", { replace: true });
            setNotice("Your password has been updated. You can now sign in.");
        } catch (reason) { setError(reason.message); }
        finally { setBusy(false); }
    }

    return <main className="account-page">
        <header className="checkout-header"><Link className="checkout-wordmark" to="/" viewTransition state={customer ? { customer } : undefined}><img className="brand-logo-image" src={storeContent?.settings?.logoUrl || "/images/saltlyne-logo-black.png"} alt="Saltlyne"/><small>LABEL</small></Link><span>MY ACCOUNT</span><Link to="/" viewTransition state={customer ? { customer } : undefined} className="checkout-back">← Back to Saltlyne</Link></header>
        <section className="account-content">
            <p className="eyebrow">SALTLYNE LABEL · CUSTOMER SPACE</p>
            <h1>{customer ? (page === "overview" ? `Welcome, ${customer.firstName || customer.name.split(" ")[0]}.` : pageTitle) : "Your account"}</h1>
            {error && <p className="account-message account-error" role="alert">{error}</p>}
            {notice && <p className="account-message" role="status">{notice}</p>}
            {loading ? <p>Loading your account…</p> : page === "forgot-password" ? <>
                <p>Enter the email address on your account. If it matches, we’ll send a one-time password reset link.</p>
                <form className="checkout-form account-auth-form" onSubmit={requestPasswordReset}>
                    <label>Email address<input name="email" type="email" autoComplete="email" required/></label>
                    <button className="checkout-primary" disabled={busy}>{busy ? "Please wait…" : "Send reset link"}</button>
                </form>
                <p className="account-track-link"><Link to="/account">Back to sign in</Link></p>
            </> : page === "reset-password" ? resetComplete ? <>
                <p>Your password reset is complete. Sign in with your new password.</p>
                <Link className="checkout-primary" to="/account">Back to sign in</Link>
            </> : resetToken ? <>
                <p>Choose a new password for your Saltlyne account.</p>
                <form className="checkout-form account-auth-form" onSubmit={completePasswordReset}>
                    <label>New password<input name="password" type="password" autoComplete="new-password" minLength="10" maxLength="128" required/></label>
                    <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength="10" maxLength="128" required/></label>
                    <button className="checkout-primary" disabled={busy}>{busy ? "Please wait…" : "Update password"}</button>
                </form>
            </> : <>
                <p>This reset link is incomplete. Request a fresh one to continue.</p>
                <Link className="account-action-link" to="/account/forgot-password">Request a reset link →</Link>
            </> : customer ? <>
                <div className="account-actions"><p>Signed in as <strong>{customer.email}</strong></p><button type="button" onClick={signOut}>Sign out</button></div>
                <div className="account-layout">
                    <nav className="account-nav" aria-label="Account pages">{accountLinks.map(([href, label]) => <Link key={href} className={location.pathname === href ? "is-active" : ""} to={href}>{label}<span>→</span></Link>)}</nav>
                    <div className="account-panel">
                        {page === "overview" && <div className="account-dashboard">
                            <div className="account-welcome"><ProfileBadge firstName={customer.firstName || customer.name.split(" ")[0]} lastName={customer.lastName} className="account-mark"/><div><p className="account-kicker">YOUR SALTLYNE SPACE</p><h2>Everything in one place.</h2><p>Track your pieces, manage your details and make the most of your rewards.</p></div></div>
                            <div className="account-stat-grid">
                                <Link to="/account/rewards"><span>LOYALTY BALANCE</span><strong>{rewards?.points || 0}<small> pts</small></strong><small>100 pts = $5 USD off</small></Link>
                                <Link to="/account/orders"><span>ORDERS</span><strong>{orders.length}</strong><small>View your order history</small></Link>
                                <Link to="/account/addresses"><span>SAVED ADDRESSES</span><strong>{addresses.length}</strong><small>Ready for your next checkout</small></Link>
                            </div>
                            <section className="account-subsection"><div className="account-section-title"><div><p className="account-kicker">RECENT ACTIVITY</p><h2>Latest orders</h2></div><Link to="/account/orders">All orders →</Link></div>
                                {orders.length ? <OrderList orders={orders.slice(0, 3)}/> : <div className="account-empty"><p>Your first Saltlyne order will be waiting here.</p><Link to="/" className="account-action-link">Explore the collection →</Link></div>}
                            </section>
                            <section className="account-subsection"><div className="account-section-title"><div><p className="account-kicker">IN YOUR ROTATION</p><h2>Products purchased</h2></div></div>
                                {productsPurchased.length ? <div className="account-product-list">{productsPurchased.slice(0, 6).map((item) => <article key={`${item.id}:${item.size || ""}`}><span>{item.name}</span><small>{item.size ? `Size ${item.size}` : "Saltlyne Label"}</small></article>)}</div> : <p className="account-muted">Your purchased pieces will appear here.</p>}
                            </section>
                        </div>}
                        {page === "orders" && <section className="account-subsection"><p className="account-kicker">YOUR PURCHASES</p><h2>Order history</h2>{orders.length ? <OrderList orders={orders}/> : <div className="account-empty"><p>No orders are linked to your account yet.</p><Link to="/" className="account-action-link">Shop the collection →</Link></div>}</section>}
                        {page === "rewards" && <section className="account-rewards">
                            <div className="account-points-card"><p className="account-kicker">YOUR REWARDS BALANCE</p><strong>{rewards?.points || 0}<small> POINTS</small></strong><p>Earn 1 point for every $1 USD spent on completed orders. Redeem from 100 points for $5 USD off a future order.</p><Link to="/checkout">Use points at checkout →</Link></div>
                            <section className="account-subsection"><p className="account-kicker">REWARD ACTIVITY</p><h2>Points & discounts history</h2>
                                {rewards?.history?.length ? <div className="account-history">{rewards.history.map((entry, index) => <article key={`${entry.orderId}-${entry.type}-${index}`}><div><strong>{entry.type === "discount" ? `Code ${entry.code}` : entry.type === "earned" ? "Points earned" : entry.type === "redeemed" ? "Points redeemed" : entry.type === "earning_reversed" ? "Earned points reversed" : "Redeemed points refunded"}</strong><small>Order {entry.orderId} · {entry.date ? new Date(entry.date).toLocaleDateString() : ""}</small></div><span className={entry.points < 0 ? "is-negative" : ""}>{entry.type === "discount" ? `−${money(entry.amountUsd)}` : `${entry.points > 0 ? "+" : ""}${entry.points} pts`}</span></article>)}</div> : <div className="account-empty"><p>Your points and applied discounts will appear here.</p></div>}
                            </section>
                        </section>}
                        {page === "addresses" && <section className="account-subsection"><div className="account-section-title"><div><p className="account-kicker">DELIVERY DETAILS</p><h2>Saved addresses</h2></div><button className="account-secondary-button" onClick={() => setAddressDraft({ id: `address-${Date.now()}`, label: "", fullName: customer.name, line1: "", line2: "", city: "", region: "", postcode: "", country: "", phone: "", isDefault: addresses.length === 0 })}>Add address +</button></div>
                            {addressDraft && <AddressEditor address={addressDraft} busy={busy} onCancel={() => setAddressDraft(null)} onSave={(address) => saveAddresses([...addresses.filter((item) => item.id !== address.id), address].map((item) => ({ ...item, isDefault: address.isDefault ? item.id === address.id : item.isDefault })))}/>}
                            {addresses.length ? <div className="account-address-list">{addresses.map((address) => <article key={address.id}><div className="account-section-title"><strong>{address.label}</strong>{address.isDefault && <span className="account-default-tag">DEFAULT</span>}</div><p>{address.fullName}<br/>{address.line1}{address.line2 && <><br/>{address.line2}</>}<br/>{[address.city, address.region, address.postcode].filter(Boolean).join(", ")}<br/>{address.country}{address.phone && <><br/>{address.phone}</>}</p><div className="account-address-actions"><button onClick={() => setAddressDraft(address)}>Edit</button><button onClick={() => saveAddresses(addresses.filter((item) => item.id !== address.id))}>Remove</button>{!address.isDefault && <button onClick={() => saveAddresses(addresses.map((item) => ({ ...item, isDefault: item.id === address.id })))}>Make default</button>}</div></article>)}</div> : !addressDraft && <div className="account-empty"><p>No saved addresses yet. Add one to speed up your next checkout.</p></div>}
                        </section>}
                        {page === "profile" && <div className="account-profile-forms">
                            <form className="checkout-form account-form" onSubmit={updateProfile}><section><p className="account-kicker">PERSONAL INFORMATION</p><h2>Your details</h2><div className="account-name-fields"><label>First name<input name="firstName" autoComplete="given-name" defaultValue={customer.firstName} maxLength="60" required/></label><label>Last name<input name="lastName" autoComplete="family-name" defaultValue={customer.lastName} maxLength="60" required/></label></div><label>Email address<input value={customer.email} readOnly/><small>Email address is used as your account sign-in.</small></label><label>Phone number<input name="phone" type="tel" autoComplete="tel" defaultValue={customer.phone}/></label><button className="checkout-primary" disabled={busy}>Save profile</button></section></form>
                            <form className="checkout-form account-form" onSubmit={updatePassword}><section><p className="account-kicker">ACCOUNT SECURITY</p><h2>Change password</h2><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required/></label><label>New password<input name="password" type="password" autoComplete="new-password" minLength="10" maxLength="128" required/></label><button className="checkout-primary" disabled={busy}>Update password</button></section></form>
                        </div>}
                        {page === "payment-methods" && <section className="account-subsection"><p className="account-kicker">PAYMENT PREFERENCES</p><h2>Payment methods</h2><div className="account-payment-note"><span className="account-payment-icon">◇</span><div><strong>Card storage is not available yet</strong><p>Saltlyne does not store card numbers or security codes. A secure card-on-file option can be enabled when a tokenizing payment provider is integrated.</p></div></div><div className="account-payment-note"><span className="account-payment-icon">↗</span><div><strong>Available at checkout</strong><p>Depending on your delivery location, you can currently choose Wise / bank transfer or cash on delivery.</p></div></div><Link className="account-action-link" to="/checkout">Continue to checkout →</Link></section>}
                        {!["overview", "orders", "rewards", "addresses", "profile", "payment-methods"].includes(page) && <p>This account page is not available.</p>}
                    </div>
                </div>
            </> : <>
                <p>Sign in to explore your orders, loyalty rewards and account preferences, or create an account for next time.</p>
                <form className="checkout-form account-auth-form" onSubmit={submitAuth}>
                    {registering && <div className="account-name-fields"><label>First name<input name="firstName" autoComplete="given-name" maxLength="60" required/></label><label>Last name<input name="lastName" autoComplete="family-name" maxLength="60" required/></label></div>}
                    <label>Email address<input name="email" type="email" autoComplete="email" required/></label>
                    <label>Password<input name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 10 : undefined} maxLength="128" required/></label>
                    <button className="checkout-primary" disabled={busy}>{busy ? "Please wait…" : registering ? "Create account" : "Sign in"}</button>
                </form>
                {!registering && <p className="account-track-link"><Link to="/account/forgot-password">Forgot your password?</Link></p>}
                <button className="account-switch" type="button" onClick={() => { setRegistering((value) => !value); setError(""); }}>{registering ? "Already have an account? Sign in" : "New to Saltlyne? Create an account"}</button>
                <p className="account-track-link">Placed an order as a guest? <Link to="/orders/track">Track your order</Link>.</p>
            </>}
        </section>
        <footer className="checkout-footer">© 2026 Saltlyne Label <span>Made for wherever life takes you.</span></footer>
    </main>;
}

function OrderList({ orders }) {
    return <div className="account-order-list">{orders.map((order) => <article key={order.id}>
        <div><strong>{order.id}</strong><small>{new Date(order.createdAt).toLocaleDateString()} · {order.items?.length || 0} item(s)</small><small>{(order.items || []).map((item) => `${item.name}${item.size ? ` · ${item.size}` : ""} ×${item.quantity}`).join(", ")}</small></div>
        <div className="account-order-total"><strong>{money(order.total, order.currency || "USD")}</strong><small>{order.status}</small></div>
        <Link to={`/orders/track?orderId=${encodeURIComponent(order.id)}`}>View order →</Link>
    </article>)}</div>;
}

function AddressEditor({ address, busy, onCancel, onSave }) {
    const [form, setForm] = useState(address);
    const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
    return <form className="account-address-editor" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
        <div className="account-section-title"><h3>{address.label ? "Edit address" : "New address"}</h3><button type="button" className="account-quiet-button" onClick={onCancel}>Cancel</button></div>
        <label>Address label<input value={form.label} onChange={(event) => update("label", event.target.value)} placeholder="Home, Work…" required/></label>
        <label>Full name<input autoComplete="name" value={form.fullName} onChange={(event) => update("fullName", event.target.value)} required/></label>
        <label>Street address<input autoComplete="address-line1" value={form.line1} onChange={(event) => update("line1", event.target.value)} required/></label>
        <label>Apartment, suite, etc. <span>(optional)</span><input autoComplete="address-line2" value={form.line2} onChange={(event) => update("line2", event.target.value)}/></label>
        <div className="account-address-fields"><label>City<input autoComplete="address-level2" value={form.city} onChange={(event) => update("city", event.target.value)} required/></label><label>State / region<input autoComplete="address-level1" value={form.region} onChange={(event) => update("region", event.target.value)}/></label><label>Postcode<input autoComplete="postal-code" value={form.postcode} onChange={(event) => update("postcode", event.target.value)}/></label></div>
        <label>Country<input autoComplete="country-name" value={form.country} onChange={(event) => update("country", event.target.value)} required/></label>
        <label>Phone<input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)}/></label>
        <label className="account-checkbox"><input type="checkbox" checked={form.isDefault} onChange={(event) => update("isDefault", event.target.checked)}/> Make this my default address</label>
        <button className="checkout-primary" disabled={busy}>Save address</button>
    </form>;
}
