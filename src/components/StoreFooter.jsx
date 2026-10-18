import { Link } from "react-router";
import IconMarks from "./IconMarks";
import PaymentMethodMarks from "./PaymentMethodMarks";

export default function StoreFooter({ logoUrl, socialIcons, paymentIcons, replaceBrandWithPaymentMethods = false, showPaymentMethods = true, homePageLayout = false, explorePageLayout = false }) {
    const layoutClass = homePageLayout ? " is-home-footer" : explorePageLayout ? " is-explore-footer" : "";
    return <footer className={`store-footer${layoutClass}`} id="contact">
        <div className="footer-main">
            <nav className="footer-link-columns" aria-label="Footer links">
                <section>
                    <h2>Help</h2>
                    <Link to="/pages/faq">Frequently asked questions</Link>
                    <Link to="/orders/track">Track an order</Link>
                    <Link to="/pages/delivery">Delivery information</Link>
                    <Link to="/pages/returns">Returns and exchanges</Link>
                    <Link to="/pages/contact">Contact us</Link>
                </section>
                <section>
                    <h2>My Account</h2>
                    <Link to="/checkout">Shopping bag</Link>
                    <Link to="/account">Order details</Link>
                    <Link to="/pages/contact">Get in touch</Link>
                </section>
                <section>
                    <h2>Pages</h2>
                    <Link to="/collections/women">Women</Link>
                    <Link to="/collections/men">Men</Link>
                    <Link to="/collections/accessories">Accessories</Link>
                    <Link to="/explore">Explore Saltlyne</Link>
                    <Link to="/story">Our story</Link>
                </section>
            </nav>
            <div className="footer-community">
                {showPaymentMethods && <IconMarks icons={paymentIcons} kind="payment" className="footer-payment-icons"/>}
                <IconMarks icons={socialIcons} kind="social" className="footer-social-icons"/>
            </div>
        </div>
        <div className="footer-brand-row">
            {replaceBrandWithPaymentMethods
                ? <PaymentMethodMarks className="footer-payment-icons footer-brand-payment-icons" icons={paymentIcons}/>
                : <Link className="wordmark footer-wordmark" to="/" aria-label="Saltlyne Label home"><img className="brand-logo-image is-light" src={logoUrl || "/images/saltlyne-logo-black.png"} alt="" /><small>LABEL</small></Link>}
            <span>Clothes for wherever life takes you.</span>
            <small>© 2026 Saltlyne Label</small>
        </div>
    </footer>;
}
