import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useCart } from "../../context/CartContext";
import { api } from "../../lib/api";
import { storeImageUrl } from "../../lib/images";
import { useStoreContent } from "../../lib/useStoreContent";
import { MINIMUM_REDEMPTION_POINTS, REDEEM_POINTS_PER_USD } from "../../../shared/loyalty.js";
import "./style.css";

const markets = [
    { country: "Sri Lanka", code: "LK", currency: "LKR" },
    { country: "Australia", code: "AU", currency: "AUD" },
    { country: "United Kingdom", code: "GB", currency: "GBP" },
    { country: "Other / international", code: "OTHER", currency: "USD" },
];
const defaultCurrencies = ["USD"];

function initialMarket(currency) {
    return markets.find((market) => market.currency === currency)?.code || "OTHER";
}

function formatCurrency(amount, currency) {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(amount) || 0);
}

export default function Checkout() {
    const { items, total, clearCart, currency, setCurrency, exchangeRates, exchangeRateUpdatedAt, exchangeRatesStale, exchangeRateError, formatMoney } = useCart();
    const { content: storeContent, error: contentError, loading: contentLoading } = useStoreContent();
    const [customer, setCustomer] = useState(null);
    const [placedOrder, setPlacedOrder] = useState(null);
    const [orderError, setOrderError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [marketCode, setMarketCode] = useState(() => initialMarket(currency));
    const [paymentMethod, setPaymentMethod] = useState("");
    const [couponInput, setCouponInput] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponError, setCouponError] = useState("");
    const [rewardPoints, setRewardPoints] = useState(0);
    const [redeemRewards, setRedeemRewards] = useState(false);
    const subtotalUsd = items.reduce((sum, item) => sum + Number(item.priceValue || 0) * item.quantity, 0);
    const rewardPointsToRedeem = redeemRewards && customer
        ? Math.floor(Math.min(Number(customer.loyaltyPoints) || 0, Math.max(0, subtotalUsd - Number(appliedCoupon?.discountUsd || 0)) * REDEEM_POINTS_PER_USD) / MINIMUM_REDEMPTION_POINTS) * MINIMUM_REDEMPTION_POINTS
        : 0;

    const paymentConfig = storeContent?.payments;
    const enabledMethods = useMemo(() => [
        ...(paymentConfig?.wiseTransfer?.enabled ? [{ id: "wise_transfer", name: "Wise / bank transfer", instructions: paymentConfig.wiseTransfer.instructions }] : []),
        ...(paymentConfig?.cashOnDelivery?.enabled ? [{ id: "cash_on_delivery", name: "Cash on delivery", instructions: paymentConfig.cashOnDelivery.instructions }] : []),
    ], [paymentConfig]);
    const supportedCurrencies = paymentConfig?.currencies || defaultCurrencies;
    const market = markets.find((item) => item.code === marketCode) || markets[3];
    const rate = Number(exchangeRates[currency]);
    const canUseCurrency = supportedCurrencies.includes(currency) && Number.isFinite(rate) && rate > 0;
    const wise = paymentConfig?.wiseTransfer;
    const selectedPaymentMethod = enabledMethods.some((method) => method.id === paymentMethod)
        ? paymentMethod
        : enabledMethods.find((method) => method.id === "cash_on_delivery")?.id || enabledMethods[0]?.id || "";

    useEffect(() => {
        api("/account/me").then(async (user) => {
            setCustomer(user);
            setRewardPoints(Number(user.loyaltyPoints) || 0);
        }).catch((error) => {
            if (error.message !== "Sign in required.") setOrderError(error.message);
        });
    }, []);

    const changeMarket = (code) => {
        const nextMarket = markets.find((item) => item.code === code) || markets[3];
        setMarketCode(nextMarket.code);
        setCurrency(nextMarket.currency);
    };

    const applyCoupon = async () => {
        setCouponError("");
        setOrderError("");
        try {
            const result = await api("/coupons/validate", {
                method: "POST",
                body: JSON.stringify({ code: couponInput, items: items.map((item) => ({ id: item.id, quantity: item.quantity })) }),
            });
            setAppliedCoupon(result);
        } catch (error) {
            setAppliedCoupon(null);
            setCouponError(error.message);
        }
    };

    const submitOrder = async (event) => {
        event.preventDefault();
        if (!items.length || !canUseCurrency || !selectedPaymentMethod) return;
        const form = new FormData(event.currentTarget);
        setSubmitting(true);
        setOrderError("");
        try {
            const address = ["address", "suburb", "postcode"].map((field) => String(form.get(field) || "").trim()).filter(Boolean).join(", ");
            const order = await api("/orders", {
                method: "POST",
                body: JSON.stringify({
                    email: form.get("email"),
                    name: form.get("name"),
                    address: [address, market.country].filter(Boolean).join(", "),
                    items: items.map((item) => ({ id: item.id, size: item.size, quantity: item.quantity })),
                    currency,
                    paymentMethod: selectedPaymentMethod,
                    couponCode: appliedCoupon?.code || "",
                    redeemPoints: rewardPointsToRedeem,
                }),
            });
            setPlacedOrder(order);
            clearCart();
        } catch (error) {
            setOrderError(error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return <main className="checkout-page">
        <header className="checkout-header"><Link className="checkout-wordmark" to="/"><img className="brand-logo-image" src={storeContent?.settings?.logoUrl || "/images/saltlyne-logo-black.png"} alt="Saltlyne"/><small>LABEL</small></Link><span>SECURE CHECKOUT <i>✳</i></span><Link to="/" className="checkout-back">← Continue shopping</Link></header>
        {placedOrder ? <section className="order-confirmation">
            <p className="eyebrow">THANK YOU FOR MOVING WITH US</p>
            <h1>Your order is<br/><em>in good hands.</em></h1>
            <p>Your order number is <strong>{placedOrder.id}</strong>. Keep this as your payment reference.</p>
            {placedOrder.emailSent === false && <p className="checkout-error" role="alert">Your order is placed, but we could not send the email confirmation. Save the order number above and contact <a href="mailto:support@saltlyne.com">support@saltlyne.com</a> if needed.</p>}
            <div className="payment-confirmation">
                <h2>{placedOrder.paymentMethod === "wise_transfer" ? "Complete your bank transfer" : "Payment on delivery"}</h2>
                <p>Amount due for items: <strong>{formatCurrency(placedOrder.total, placedOrder.currency)}</strong></p>
                <p>Delivery charges are quoted separately and are not included in this subtotal.</p>
                {placedOrder.paymentMethod === "wise_transfer" ? <div className="transfer-instructions">
                    {wise?.bankName && <p><strong>Bank / provider</strong><br/>{wise.bankName}</p>}
                    {wise?.accountHolder && <p><strong>Account holder</strong><br/>{wise.accountHolder}</p>}
                    {wise?.accountDetails && <p><strong>Transfer details</strong><br/><span>{wise.accountDetails}</span></p>}
                    {wise?.swiftBic && <p><strong>SWIFT / BIC</strong><br/>{wise.swiftBic}</p>}
                    <p>{wise?.instructions}</p>
                    <p>Include <strong>{placedOrder.id}</strong> in the transfer reference. Your order remains awaiting manual payment confirmation.</p>
                </div> : <p>{paymentConfig?.cashOnDelivery?.instructions || "Please pay when your order is delivered."}</p>}
                {placedOrder.exchangeRateUpdatedAt && <small>Currency conversion based on daily rates updated {new Date(placedOrder.exchangeRateUpdatedAt).toLocaleString()}.</small>}
            </div>
            <Link className="checkout-primary" to={`/orders/track?orderId=${encodeURIComponent(placedOrder.id)}`}>Track your order </Link>
            <p><Link to="/account">Create an account or sign in</Link> to keep track of your orders.</p>
        </section> : <div className="checkout-layout">
            <section className="checkout-main"><p className="eyebrow">A FEW DETAILS AND YOU’RE THERE</p><h1>Checkout</h1>
                {items.length ? <form className="checkout-form" onSubmit={submitOrder}>
                    <section><h2>Contact</h2><label>Email address<input type="email" name="email" autoComplete="email" placeholder="you@example.com" defaultValue={customer?.email || ""} required/></label></section>
                    <section><h2>Delivery</h2><div className="checkout-fields"><label className="field-wide">Full name<input name="name" autoComplete="name" defaultValue={customer?.name || ""} required/></label><label className="field-wide">Address<input name="address" autoComplete="street-address" required/></label><label>Suburb<input name="suburb" autoComplete="address-level2" required/></label><label>Postcode<input name="postcode" autoComplete="postal-code" required/></label><label className="field-wide">Country / region<select name="country" value={marketCode} onChange={(event) => changeMarket(event.target.value)}><option value="LK">Sri Lanka · LKR</option><option value="AU">Australia · AUD</option><option value="GB">United Kingdom · GBP</option><option value="OTHER">Other / international · USD</option></select></label></div></section>
                    <section className="checkout-discounts"><h2>Discounts & rewards</h2><div className="checkout-coupon-entry"><label>Discount code<input value={couponInput} onChange={(event) => { setCouponInput(event.target.value); if (appliedCoupon) setAppliedCoupon(null); }} placeholder="Enter code" autoCapitalize="characters"/></label><button type="button" onClick={applyCoupon} disabled={!couponInput.trim()}>Apply</button></div>
                        {couponError && <p className="checkout-error" role="alert">{couponError}</p>}
                        {appliedCoupon && <p className="checkout-discount-success" role="status">{appliedCoupon.code} applied · −{formatMoney(appliedCoupon.discountUsd)}</p>}
                        {customer ? <label className="checkout-rewards-toggle"><input type="checkbox" checked={redeemRewards} onChange={(event) => setRedeemRewards(event.target.checked)}/><span><strong>Use Saltlyne points</strong><small>Balance: {rewardPoints} points{rewardPointsToRedeem ? ` · redeem ${rewardPointsToRedeem} for ${formatMoney(rewardPointsToRedeem / REDEEM_POINTS_PER_USD)} off` : " · 100 points = $5 USD"}</small></span></label> : <p className="payment-note"><Link to="/account">Sign in</Link> to redeem loyalty points.</p>}
                    </section>
                    <section><h2>Payment</h2>
                        {contentLoading ? <p className="payment-note">Loading available payment options…</p> : contentError ? <p className="checkout-error" role="alert">{contentError}</p> : enabledMethods.length ? <div className="checkout-payment-options">
                            {enabledMethods.map((method) => <label className={`checkout-payment-option${paymentMethod === method.id ? " is-selected" : ""}`} key={method.id}>
                                <input type="radio" name="paymentMethod" value={method.id} checked={selectedPaymentMethod === method.id} onChange={() => setPaymentMethod(method.id)}/>
                                <span><strong>{method.name}</strong><small>{method.instructions}</small></span>
                            </label>)}
                        </div> : <p className="checkout-error" role="alert">No payment methods are enabled. Contact the store.</p>}
                        {!supportedCurrencies.includes(currency) && <p className="checkout-error" role="alert">{currency} is not enabled for checkout. Select another country or contact the store.</p>}
                        {currency !== "USD" && exchangeRateUpdatedAt && <p className="payment-note">Approximate daily conversion: 1 USD = {Number(rate).toLocaleString(undefined, { maximumFractionDigits: 4 })} {currency} · Updated {new Date(exchangeRateUpdatedAt).toLocaleDateString()}{exchangeRatesStale ? " · Using a recent cached rate" : ""}.</p>}
                        {exchangeRateError && currency !== "USD" && <p className="checkout-error" role="alert">{exchangeRateError}</p>}
                    </section>
                    {orderError && <p className="checkout-error" role="alert">{orderError}</p>}
                    <button className="checkout-primary" type="submit" disabled={submitting || contentLoading || Boolean(contentError) || !enabledMethods.length || !selectedPaymentMethod || !canUseCurrency}>{submitting ? "Creating order…" : "Place order"}</button>
                    <p className="checkout-footnote">Bank transfers are confirmed manually. No card payment is taken online.</p>
                </form> : <div className="checkout-empty"><h2>Your bag is empty</h2><p>Add a few favourites before heading to checkout.</p><Link to="/" className="checkout-primary">Shop the collection </Link></div>}
            </section>
            <aside className="checkout-order"><h2>Your order <span>{items.reduce((sum, item) => sum + item.quantity, 0)} items</span></h2>{items.map((item) => <div className="checkout-line" key={`${item.id || item.name}-${item.size || "default"}`}><div className="checkout-thumb"><img src={storeImageUrl(item.image, 240)} alt=""/><b>{item.quantity}</b></div><div><strong>{item.name}</strong><small>{item.size ? `Size ${item.size} · ` : ""}Saltlyne Label</small></div><span>{formatMoney(item.priceValue * item.quantity)}</span></div>)}<div className="checkout-subtotal"><span>Items subtotal</span><span>{formatMoney(total)}</span></div>{appliedCoupon && <div className="checkout-subtotal checkout-savings"><span>Code {appliedCoupon.code}</span><span>−{formatMoney(appliedCoupon.discountUsd)}</span></div>}{rewardPointsToRedeem > 0 && <div className="checkout-subtotal checkout-savings"><span>Points ({rewardPointsToRedeem})</span><span>−{formatMoney(rewardPointsToRedeem / REDEEM_POINTS_PER_USD)}</span></div>}<div className="checkout-shipping"><span>Shipping</span><span>Quoted separately</span></div><div className="checkout-total"><strong>Estimated total</strong><strong>{formatMoney(Math.max(0, total - Number(appliedCoupon?.discountUsd || 0) - rewardPointsToRedeem / REDEEM_POINTS_PER_USD))}</strong></div><small className="checkout-currency-note">Delivery charges are confirmed separately and are not included. Prices are converted from USD using a daily exchange rate. Final transfer fees may depend on your bank.</small><p>Thoughtfully made. Carefully packed. On its way to you.</p></aside>
        </div>}
        <footer className="checkout-footer">© 2026 Saltlyne Label <span>Made for wherever life takes you.</span></footer>
    </main>;
}
