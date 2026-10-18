import React, { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api } from "../../lib/api";
import { useStoreContent } from "../../lib/useStoreContent";
import "./style.css";

export default function OrderTracking() {
    const { content: storeContent } = useStoreContent();
    const [params] = useSearchParams();
    const formatOrderTotal = (amount, currency = "USD") => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(amount) || 0);
    const [order, setOrder] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    async function lookup(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        setOrder(null);
        const form = new FormData(event.currentTarget);
        try {
            setOrder(await api("/orders/track", { method: "POST", body: JSON.stringify(Object.fromEntries(form.entries())) }));
        } catch (reason) {
            setError(reason.message);
        } finally {
            setBusy(false);
        }
    }

    return <main className="order-track-page">
        <header className="checkout-header"><Link className="checkout-wordmark" to="/"><img className="brand-logo-image" src={storeContent?.settings?.logoUrl || "/images/saltlyne-logo-black.png"} alt="Saltlyne"/><small>LABEL</small></Link><span>ORDER TRACKING</span><Link to="/" className="checkout-back">← Back to Saltlyne</Link></header>
        <section className="order-track-content">
            <p className="eyebrow">A LITTLE UPDATE ON YOUR ORDER</p><h1>Track your order</h1>
            <p>Enter the order number and the email address used at checkout.</p>
            <form className="checkout-form order-track-form" onSubmit={lookup}>
                <label>Order number<input name="orderId" defaultValue={params.get("orderId") || ""} autoComplete="off" required/></label>
                <label>Email address<input name="email" type="email" autoComplete="email" required/></label>
                {error && <p className="checkout-error" role="alert">{error}</p>}
                <button className="checkout-primary" disabled={busy}>{busy ? "Looking up…" : "Find order"}</button>
            </form>
            {order && <section className="order-track-result" aria-live="polite">
                <p className="eyebrow">ORDER {order.id}</p><h2>{order.status}</h2>
                <p>Placed {new Date(order.createdAt).toLocaleDateString()} · Total {formatOrderTotal(order.total, order.currency)}</p>
                {order.paymentMethod && <p>Payment: {order.paymentMethod === "wise_transfer" ? "Wise / bank transfer" : "Cash on delivery"} · {String(order.paymentStatus || "").replaceAll("_", " ")}</p>}
                <ul>{order.items.map((item) => <li key={`${item.id}-${item.size || ""}`}>{item.name}{item.size ? ` · ${item.size}` : ""} × {item.quantity}</li>)}</ul>
            </section>}
            <p className="order-track-account">Have an account? <Link to="/account">Sign in to view your order history</Link>.</p>
        </section>
        <footer className="checkout-footer">© 2026 Saltlyne Label <span>Made for wherever life takes you.</span></footer>
    </main>;
}
