import React, { useLayoutEffect } from "react";
import { Link, useLocation } from "react-router";
import { useCart } from "../../context/CartContext";
import { restoreExploreScroll } from "../../lib/exploreNavigation";
import { useStoreContent } from "../../lib/useStoreContent";
import StoreFooter from "../../components/StoreFooter";
import ComingSoonSection from "./ComingSoonSection";
import "./style.css";

const drops = [
    {
        label: "WOMEN",
        title: "NEW IN: WOMEN'S POWERHOUSE",
        image: "/images/women-training.jpg",
        alt: "Saltlyne women's training collection",
        href: "/collections/women",
    },
    {
        label: "MEN",
        title: "NEW IN: MEN'S HYBRID",
        image: "/images/men-training.jpg",
        alt: "Saltlyne men's hybrid training collection",
        href: "/collections/men",
    },
    {
        label: "ACCESSORIES",
        title: "NEW IN: ACCESSORIES LOAD",
        image: "/images/coastal-training-accessories.jpg",
        alt: "Saltlyne training accessories for coastal movement",
        href: "/collections/accessories",
    },
];

export default function Explore() {
    const { count } = useCart();
    const location = useLocation();
    const { content: storeContent } = useStoreContent();
    const exploreDrops = storeContent?.explore?.drops?.length ? storeContent.explore.drops.map((drop) => ({
        label: drop.label,
        title: drop.title,
        image: drop.imageUrl,
        alt: drop.imageAlt,
        video: drop.videoUrl,
        href: drop.link,
    })) : drops;
    const navigationCategories = (storeContent?.categories ?? [{ slug: "women", title: "Women" }, { slug: "men", title: "Men" }, { slug: "accessories", title: "Accessories" }])
        .filter((category) => category.active !== false)
        .slice()
        .sort((left, right) => Number(left.displayOrder || 0) - Number(right.displayOrder || 0));

    useLayoutEffect(() => {
        if (location.hash === "#new-collection") {
            const frame = window.requestAnimationFrame(() => {
                document.getElementById("new-collection")?.scrollIntoView();
            });
            return () => window.cancelAnimationFrame(frame);
        }
        restoreExploreScroll();
    }, [location.hash]);

    return <main className="shop-page explore-page">
        <div className="shop-announcement">{storeContent?.settings?.siteAnnouncement?.label || "SALTLYNE LABEL"} <span>·</span> {storeContent?.settings?.siteAnnouncement?.text || "CLOTHES FOR WHEREVER LIFE TAKES YOU"}</div>
        <header className="shop-header"><Link className="shop-logo" to="/" viewTransition aria-label="Saltlyne home"><img className="brand-logo-image" src={storeContent?.settings?.logoUrl || "/images/saltlyne-logo-black.png"} alt="Saltlyne"/><small>LABEL</small></Link><Link className="shop-bag" to="/checkout" viewTransition aria-label={`Shopping bag with ${count} items`}><span>Bag</span><b>{count}</b></Link>        </header>
        <nav className="shop-main-navigation" aria-label="Main navigation">
            {navigationCategories.map((category) => <Link key={category.slug} to={`/collections/${category.slug}`} viewTransition>{category.title || category.label}</Link>)}
            <Link className="selected" to="/explore" viewTransition>Explore</Link>
        </nav>

        <ComingSoonSection content={storeContent?.explore}/>

        <div className="explore-drops">
            {exploreDrops.map((drop, index) => <section className="explore-drop" key={drop.label} aria-label={drop.title}>
                {drop.videoUrl || drop.video
                    ? <video className="explore-drop-media" autoPlay muted loop playsInline preload="metadata" poster={drop.imageUrl || drop.image} aria-label={drop.imageAlt || drop.alt}><source src={drop.videoUrl || drop.video} type="video/mp4"/></video>
                    : <img className="explore-drop-media" src={drop.imageUrl || drop.image} alt={drop.imageAlt || drop.alt}/>}
                <div className="explore-drop-shade"/>
                <div className="explore-drop-copy">
                    <p>{drop.label}</p>
                    {index === 0 ? <h1><Link className="explore-drop-title-link" to={drop.link || drop.href || "/explore"}>{drop.title}</Link></h1> : <h2><Link className="explore-drop-title-link" to={drop.link || drop.href || "/explore"}>{drop.title}</Link></h2>}
                </div>
            </section>)}
        </div>

        <StoreFooter logoUrl={storeContent?.settings?.logoUrl} socialIcons={storeContent?.settings?.social} paymentIcons={storeContent?.paymentIcons} replaceBrandWithPaymentMethods showPaymentMethods={false} explorePageLayout/>
    </main>;
}
