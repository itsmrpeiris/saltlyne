import React, {useEffect} from "react";
import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider } from "react-router";
import AOS from "aos";
import Collection from "./screens/Collection";
import ShopCollection from "./screens/ShopCollection";
import Explore from "./screens/Explore";
import Checkout from "./screens/Checkout";
import Account from "./screens/Account";
import OrderTracking from "./screens/OrderTracking";
import Product from "./screens/Product";
import { HelpPage, NewsletterUnsubscribe, StoryPage } from "./screens/ContentPages";
import { CartProvider } from "./context/CartContext";
import { AdminGate, AdminLogin } from "./screens/Admin";

const RootLayout = () => {
    useEffect(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        let initialized = false;
        let refreshFrame = 0;
        const revealTargets = [
            "main:not(.admin-shell):not(.admin-login-page) > :is(header,nav,section,article,footer)",
            "main:not(.admin-shell):not(.admin-login-page) section:not(.our-story-chapter):not(.sr-only):not([aria-hidden='true'])",
            "main:not(.admin-shell):not(.admin-login-page) article:not(.sr-only)",
            ".shop-product-card",
            ".explore-drop",
            ".account-stat-grid > a",
        ].join(",");

        const addRevealAnimations = (mutations) => {
            if (reducedMotion.matches) return;
            const candidates = new Set();
            const collectTargets = (root) => {
                if (!(root instanceof Element)) return;
                if (root.matches(revealTargets)) candidates.add(root);
                root.querySelectorAll(revealTargets).forEach((element) => candidates.add(element));
            };
            if (mutations) {
                mutations.forEach(({ addedNodes }) => addedNodes.forEach(collectTargets));
            } else {
                document.querySelectorAll(revealTargets).forEach((element) => candidates.add(element));
            }
            let addedTargets = false;
            candidates.forEach((element) => {
                if (element.closest("[inert],[aria-hidden='true'],.sr-only") || element.hasAttribute("data-aos")) return;
                element.setAttribute("data-aos", "fade-up");
                if (element.matches(".shop-product-card,.explore-drop,.account-stat-grid > a")) {
                    const siblingIndex = Array.from(element.parentElement.children).indexOf(element) % 4;
                    element.setAttribute("data-aos-delay", String(siblingIndex * 65));
                }
                addedTargets = true;
            });
            if (addedTargets && initialized) {
                window.cancelAnimationFrame(refreshFrame);
                refreshFrame = window.requestAnimationFrame(() => AOS.refreshHard());
            }
        };

        addRevealAnimations();
        AOS.init({
            duration: 950,
            easing: "ease-out-cubic",
            once: true,
            offset: 56,
            disable: () => reducedMotion.matches,
        });
        initialized = true;
        const routeObserver = new MutationObserver(addRevealAnimations);
        routeObserver.observe(document.body, { childList: true, subtree: true });
        return () => {
            routeObserver.disconnect();
            window.cancelAnimationFrame(refreshFrame);
        };
    }, []);
    return <CartProvider><Outlet /></CartProvider>;
};

const router = createBrowserRouter(createRoutesFromElements(
    <Route element={<RootLayout />}>
        <Route path="/" element={<Collection />} />
        <Route path="/collections/:gender" element={<ShopCollection />} />
        <Route path="/new-collection" element={<Navigate to="/explore" replace />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/products/:slug" element={<Product />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/*" element={<Account />} />
        <Route path="/orders/track" element={<OrderTracking />} />
        <Route path="/story" element={<StoryPage />} />
        <Route path="/about" element={<StoryPage />} />
        <Route path="/pages/:slug" element={<HelpPage />} />
        <Route path="/newsletter/unsubscribe" element={<NewsletterUnsubscribe />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminGate section="overview" />} />
        <Route path="/admin/products" element={<AdminGate section="products" />} />
        <Route path="/admin/orders" element={<AdminGate section="orders" />} />
        <Route path="/admin/customers" element={<AdminGate section="customers" />} />
        <Route path="/admin/coupons" element={<AdminGate section="coupons" />} />
        <Route path="/admin/content" element={<AdminGate section="content" />} />
        <Route path="/admin/newsletter" element={<AdminGate section="newsletter" />} />
    </Route>
));

const App = () => <RouterProvider router={router} />;

export default App;
