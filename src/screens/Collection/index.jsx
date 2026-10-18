import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useCart } from "../../context/CartContext";
import { api } from "../../lib/api";
import { mergeCatalog } from "../../lib/catalog";
import { storeImageUrl } from "../../lib/images";
import { useStoreContent } from "../../lib/useStoreContent";
import { rememberExploreScroll } from "../../lib/exploreNavigation";
import { seedProducts, slugify } from "../../../shared/catalog.js";
import StoreFooter from "../../components/StoreFooter";
import ProfileBadge from "../../components/ProfileBadge";
import "./style.css";

const imageUrl = storeImageUrl;
const products = seedProducts.filter((product) => product.gender === "women").slice(0, 4);
const formatCatalogProduct = (product) => {
    const priceValue = product.onSale && Number(product.salePrice) > 0 && Number(product.salePrice) < Number(product.price) ? Number(product.salePrice) : Number(product.price);
    return { ...product, priceValue, price: `$${priceValue.toFixed(0)}` };
};
const resetHomeScroll = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    window.scrollTo({ top: 0, behavior: "instant" });
};
const storyChapters = [
    {
        title: "Purpose",
        blocks: [
            { type: "paragraph", text: "Saltlyne was born from a powerful message in the Sermon on the Mount: “You are the salt of the earth.” To us, salt represents purpose, identity, and the impact we can have on the world around us." },
            { type: "paragraph", text: "But Saltlyne is also a story of losing yourself and finding your way back." },
        ],
    },
    {
        title: "Losing your way",
        blocks: [
            { type: "paragraph", text: "Our founder was once deeply connected to an athletic lifestyle. It was more than a passion; it was part of who he was. But life took him away from that identity, and it took him ten years to rediscover the person he once knew and return to what he loved." },
        ],
    },
    {
        title: "Finding your way back",
        blocks: [
            { type: "paragraph", text: "Saltlyne was born from that journey." },
            { type: "paragraph", text: "This collection represents the belief that, no matter how chaotic life becomes or how far we drift from ourselves, we can always find our way back." },
        ],
    },
    {
        title: "Your journey",
        blocks: [
            { type: "quote", text: "Just as the salt water finds its way to the shore, we believe we can find our way back to who we truly are." },
            { type: "paragraph", text: "Saltlyne is for everyone on that journey. A reminder to embrace who you are, trust your own timing, and never lose sight of what makes you, you." },
            { type: "closing", text: "Saltlyne Label — More than what you wear. A reminder of who you are." },
        ],
    },
];

const campaigns = [
    { eyebrow: "SRI LANKA, BY THE COAST — DROP 04", title: <>Move with<br />your own <em>current.</em></>, description: <>Coastal air. Open roads. Room to move.<br />Active essentials for wherever the day takes you.</>, caption: "Find your pace by the sea", image: "/images/women-galle-hero.jpg" },
    { eyebrow: "NEW SEASON — FIND YOUR FLOW", title: <>Find your<br /><em>element.</em></>, description: <>Light layers, easy comfort.<br />Made for wherever today takes you.</>, caption: "Meet the movement edit", image: "/images/women-solo-teal-coast.jpg" },
    { eyebrow: "THE SOFT SIDE OF STRONG", title: <>Feel good<br /><em>doing you.</em></>, description: <>Your everyday uniform, reimagined.<br />Considered essentials for every kind of day.</>, caption: "Discover your new essentials", image: "/images/women-solo-pink-studio.jpg" },
];
const defaultAnnouncements = [
    { audience: "WOMEN’S EDIT", text: "A little something for your next move.", linkText: "shop the new drop", link: "#new" },
    { audience: "MEN’S EDIT", text: "Made to move. Built for more.", linkText: "shop the new drop", link: "#new" },
];

const searchIndex = [
    { title: "New collection", detail: "The next Saltlyne drop", keywords: "new latest latest drop arrivals launch", href: "/explore#new-collection" },
    { title: "Coastal running", detail: "Saltlyne by the sea", keywords: "coastal coast running run galle fort sea ocean", href: "/collections/women?activity=run" },
    { title: "Women’s activewear", detail: "Shop women", keywords: "women womens leggings bra activewear clothing", href: "/collections/women" },
    { title: "Men’s activewear", detail: "Shop men", keywords: "men mens tops t shirts activewear clothing", href: "/collections/men" },
    { title: "Accessories", detail: "Bags, socks and more", keywords: "accessories bags socks headwear caps equipment underwear", href: "/collections/accessories" },
    { title: "Our story", detail: "Get to know Saltlyne", keywords: "about story brand sri lanka galle", href: "#story" },
    ...products.map((product) => ({ title: product.name, detail: product.tag, keywords: `${product.name} ${product.tag} activewear apparel`, href: `/collections/women?category=${slugify(product.category)}` })),
];

export default function Collection() {
    const location = useLocation();
    const navigate = useNavigate();
    const { items: cartItems, changeQuantity, removeItem, count: cartCount, total: cartTotal, formatMoney } = useCart();
    const [signedInCustomer, setSignedInCustomer] = useState(() => location.state?.customer || null);
    const [email, setEmail] = useState("");
    const [subscribed, setSubscribed] = useState(false);
    const [newsletterError, setNewsletterError] = useState("");
    const [newsletterDeliveryError, setNewsletterDeliveryError] = useState(false);
    const [activeCampaign, setActiveCampaign] = useState(0);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [artMode, setArtMode] = useState(() => window.localStorage.getItem("saltlyne-art-mode") === "on");
    const [cartOpen, setCartOpen] = useState(false);
    const [announcementIndex, setAnnouncementIndex] = useState(0);
    const [headerOverHero, setHeaderOverHero] = useState(true);
    const [catalog, setCatalog] = useState(() => products.map(formatCatalogProduct));
    const [catalogError, setCatalogError] = useState("");
    const { content: storeContent } = useStoreContent();
    const searchInput = useRef(null);
    const campaignTrack = useRef(null);
    const storyScroller = useRef(null);
    const campaignSlides = useMemo(() => storeContent?.home?.slides?.length
        ? storeContent.home.slides.map((slide) => {
            const title = (slide.headlineLines || []).map((line, index) => {
                const emphasisIndex = line.indexOf(slide.emphasis || "");
                const content = emphasisIndex >= 0 && slide.emphasis
                    ? <>{line.slice(0, emphasisIndex)}<em>{slide.emphasis}</em>{line.slice(emphasisIndex + slide.emphasis.length)}</>
                    : line;
                return <React.Fragment key={`${line}-${index}`}>{index > 0 && <br/>}{content}</React.Fragment>;
            });
            return {
                eyebrow: slide.eyebrow,
                title: <>{title}</>,
                description: (slide.descriptionLines || []).map((line, index) => <React.Fragment key={`${line}-${index}`}>{index > 0 && <br/>}{line}</React.Fragment>),
                image: slide.imageUrl,
                imageAlt: slide.imageAlt,
                video: slide.videoUrl,
            };
        })
        : campaigns, [storeContent]);
    const campaign = campaignSlides[Math.min(activeCampaign, campaignSlides.length - 1)] || campaigns[0];
    const announcements = storeContent?.settings?.announcements?.length ? storeContent.settings.announcements : defaultAnnouncements;
    const activeAnnouncement = announcements[announcementIndex % announcements.length];
    const navigationCategories = (storeContent?.categories ?? [{ slug: "women", title: "Women" }, { slug: "men", title: "Men" }, { slug: "accessories", title: "Accessories" }])
        .filter((category) => category.active !== false)
        .slice()
        .sort((left, right) => Number(left.displayOrder || 0) - Number(right.displayOrder || 0));
    const story = storeContent?.home?.story?.length ? storeContent.home.story : storyChapters;
    const manifesto = storeContent?.home?.manifesto || { eyebrow: "SALTLYNE IS A STATE OF MIND", headlineLines: ["MADE TO MOVE.", "MADE TO FEEL", "LIKE YOU."], emphasis: "LIKE YOU.", body: "Some days are for the long way home. Some are for showing up. Find pieces that feel right for all of it.", buttonText: "EXPLORE SALTLYNE", buttonLink: "/explore" };
    const membership = storeContent?.home?.membership || { imageUrl: "/images/women-training.jpg", imageAlt: "Saltlyne athlete training with dumbbells", eyebrow: "A PLACE TO MOVE YOUR WAY", headlineLines: ["Join the", "Saltlyne Club."], emphasis: "Saltlyne Club.", body: "For every pace, every path, and every version of you. Get thoughtful notes, first word on new drops, and a little inspiration for wherever life takes you.", buttonText: "Join the club", note: "No noise. Just the good stuff, now and then." };
    const newsletter = storeContent?.home?.newsletter || { eyebrow: "LETTERS FROM THE SLOW LANE", headlineLines: ["A little room", "in your inbox."], body: "New drops, thoughtful notes and 10% off your first order.", buttonText: "Sign me up", consentText: "By signing up, you agree to receive the occasional note from us." };
    const searchTerms = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const searchableItems = [...searchIndex, ...catalog.map((product) => ({ title: product.name, detail: product.tag, keywords: `${product.name} ${product.tag} ${product.description || ""}`, href: `/collections/${product.gender}?category=${slugify(product.category)}` }))];
    const searchResults = searchTerms.length ? Array.from(new Map(searchableItems.filter((item) => searchTerms.every((term) => `${item.title} ${item.detail} ${item.keywords}`.toLowerCase().includes(term))).map((item) => [item.title, item])).values()).slice(0, 6) : [];
    useEffect(() => {
        window.localStorage.setItem("saltlyne-art-mode", artMode ? "on" : "off");
        document.documentElement.classList.toggle("is-art-mode", artMode);
    }, [artMode]);
    useEffect(() => {
        if (searchOpen) searchInput.current?.focus();
    }, [searchOpen]);

    useEffect(() => {
        if (location.hash !== "#newsletter") return;
        const frame = window.requestAnimationFrame(() => {
            const newsletterSection = document.getElementById("newsletter");
            const emailInput = document.getElementById("email-address");
            if (!newsletterSection || !emailInput) return;
            newsletterSection.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
                block: "center",
            });
            emailInput.focus({ preventScroll: true });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [location.hash]);

    useEffect(() => {
        let active = true;
        api("/account/me").then((customer) => {
            if (active) setSignedInCustomer(customer);
        }).catch((error) => {
            if (error.message !== "Sign in required.") console.error("Could not load the signed-in customer profile.", error);
        });
        return () => { active = false; };
    }, [location.state?.customer]);

    useEffect(() => {
        const updateCampaignOnScroll = () => {
            const track = campaignTrack.current;
            if (!track) return;

            const trackBounds = track.getBoundingClientRect();
            const scrollableDistance = track.offsetHeight - window.innerHeight;
            const progress = scrollableDistance > 0
                ? Math.max(0, Math.min(1, -trackBounds.top / scrollableDistance))
                : 0;
            const nextCampaign = Math.min(campaignSlides.length - 1, Math.floor(progress * campaignSlides.length));

            track.style.setProperty("--campaign-scroll-progress", progress);
            track.style.setProperty("--campaign-scroll-shift", `${progress * 24}px`);
            const headerHeight = document.querySelector(".store-header-shell")?.getBoundingClientRect().height ?? 0;
            const nextHeaderOverHero = trackBounds.bottom > headerHeight;
            setHeaderOverHero((current) => current === nextHeaderOverHero ? current : nextHeaderOverHero);
            setActiveCampaign((current) => current === nextCampaign ? current : nextCampaign);
        };

        updateCampaignOnScroll();
        window.addEventListener("scroll", updateCampaignOnScroll, { passive: true });
        window.addEventListener("resize", updateCampaignOnScroll);
        return () => {
            window.removeEventListener("scroll", updateCampaignOnScroll);
            window.removeEventListener("resize", updateCampaignOnScroll);
        };
    }, [campaignSlides.length]);

    useEffect(() => {
        const scroller = storyScroller.current;
        if (!scroller) return;

        const characters = scroller.querySelectorAll("[data-story-character]");
        const chapters = [...scroller.querySelectorAll("[data-story-chapter]")];
        const chapterControls = [...document.querySelectorAll("[data-story-chapter-control]")];
        const progressBar = document.querySelector(".our-story-scroll-progress");
        const characterCount = characters.length;
        let visibleCharacters = 0;
        let frame = 0;

        const updateTypedStory = () => {
            frame = 0;
            const scrollableDistance = scroller.scrollHeight - scroller.clientHeight;
            const progress = scrollableDistance > 0 ? scroller.scrollTop / scrollableDistance : 1;
            const nextVisibleCharacters = Math.ceil((0.04 + progress * 0.96) * characterCount);
            const start = Math.min(visibleCharacters, nextVisibleCharacters);
            const end = Math.max(visibleCharacters, nextVisibleCharacters);

            for (let index = start; index < end; index += 1) {
                characters[index]?.classList.toggle("is-typed", index < nextVisibleCharacters);
            }
            visibleCharacters = nextVisibleCharacters;
            scroller.style.setProperty("--story-progress", progress);
            progressBar?.setAttribute("aria-valuenow", String(Math.round(progress * 100)));

            const bounds = scroller.getBoundingClientRect();
            const activeChapter = chapters.reduce((activeIndex, chapter, index) => {
                const chapterTop = chapter.getBoundingClientRect().top - bounds.top + scroller.scrollTop;
                return chapterTop <= scroller.scrollTop + 48 ? index : activeIndex;
            }, 0);
            chapterControls.forEach((control, index) => {
                if (index === activeChapter) control.setAttribute("aria-current", "step");
                else control.removeAttribute("aria-current");
            });
        };

        const onScroll = () => {
            if (!frame) frame = window.requestAnimationFrame(updateTypedStory);
        };
        const onWheel = (event) => {
            const atTop = scroller.scrollTop <= 0;
            const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
            const handingOffDown = event.deltaY > 0 && atBottom;
            const handingOffUp = event.deltaY < 0 && atTop;
            if (!handingOffDown && !handingOffUp) return;

            event.preventDefault();
            window.scrollTo({ top: window.scrollY + event.deltaY, behavior: "instant" });
        };
        let previousTouchY = null;
        const onTouchStart = (event) => {
            previousTouchY = event.touches[0]?.clientY ?? null;
        };
        const onTouchMove = (event) => {
            const touchY = event.touches[0]?.clientY;
            if (previousTouchY === null || touchY === undefined) return;

            const pageDelta = previousTouchY - touchY;
            previousTouchY = touchY;
            const atTop = scroller.scrollTop <= 0;
            const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
            const handingOffDown = pageDelta > 0 && atBottom;
            const handingOffUp = pageDelta < 0 && atTop;
            if (!handingOffDown && !handingOffUp) return;

            event.preventDefault();
            window.scrollTo({ top: window.scrollY + pageDelta, behavior: "instant" });
        };
        const onTouchEnd = () => { previousTouchY = null; };

        updateTypedStory();
        window.addEventListener("resize", onScroll);
        scroller.addEventListener("scroll", onScroll, { passive: true });
        scroller.addEventListener("wheel", onWheel, { passive: false });
        scroller.addEventListener("touchstart", onTouchStart, { passive: true });
        scroller.addEventListener("touchmove", onTouchMove, { passive: false });
        scroller.addEventListener("touchend", onTouchEnd, { passive: true });
        scroller.addEventListener("touchcancel", onTouchEnd, { passive: true });
        return () => {
            window.removeEventListener("resize", onScroll);
            scroller.removeEventListener("scroll", onScroll);
            scroller.removeEventListener("wheel", onWheel);
            scroller.removeEventListener("touchstart", onTouchStart);
            scroller.removeEventListener("touchmove", onTouchMove);
            scroller.removeEventListener("touchend", onTouchEnd);
            scroller.removeEventListener("touchcancel", onTouchEnd);
            if (frame) window.cancelAnimationFrame(frame);
        };
    }, []);

    useEffect(() => {
        api("/products").then((items) => setCatalog(mergeCatalog(items).map(formatCatalogProduct))).catch((error) => setCatalogError(error.message));
    }, []);

    useEffect(() => {
        const interval = window.setInterval(() => setAnnouncementIndex((current) => current + 1), storeContent?.settings?.announcementIntervalMs || 5000);
        return () => window.clearInterval(interval);
    }, [storeContent?.settings?.announcementIntervalMs]);

    async function submitNewsletter(event) {
        event.preventDefault();
        setNewsletterError("");
        setNewsletterDeliveryError(false);
        try {
            const form = new FormData(event.currentTarget);
            const response = await api("/newsletter", { method: "POST", body: JSON.stringify({ email, consent: form.get("newsletter-consent") === "on" }) });
            setSubscribed(true);
            setNewsletterDeliveryError(response.emailSent === false);
        } catch (error) {
            setNewsletterError(error.message);
        }
    }

    return (
        <main className={`saltlyne-store ${artMode ? "is-art-mode" : ""}`}>
            {storeContent?.settings?.announcementActive !== false && <div className={`announcement ${announcementIndex % 2 ? "announcement-men" : "announcement-women"}`} aria-live="polite" aria-atomic="true"><div className="announcement-copy" key={announcementIndex % announcements.length}><span className="announcement-audience">{activeAnnouncement.audience}</span><span>{activeAnnouncement.text}</span><span className="announcement-divider">—</span><a href={activeAnnouncement.link || "#new"}>{activeAnnouncement.linkText}</a></div></div>}
            {catalogError && <p className="store-content-error" role="status">Live products could not be loaded: {catalogError}</p>}
            <div className={`store-header-shell ${headerOverHero ? "is-over-hero" : "is-past-hero"}`}>
            <header className="store-header header-ink-dark">
                    <div className="header-left-actions">
                        <nav className="primary-nav" aria-label="Main navigation">
                            {navigationCategories.map((category) => <Link key={category.slug} to={`/collections/${category.slug}`} viewTransition onClick={resetHomeScroll}>{category.title || category.label}</Link>)}
                            <Link to="/explore" viewTransition onClick={(event) => { resetHomeScroll(event); rememberExploreScroll(event); }}>Explore</Link>
                        </nav>
                    </div>
                    <div className="header-brand-cluster">
                        <Link className="wordmark logo-menu-trigger" to="/" viewTransition aria-label="Saltlyne Label home">
                            <span className="brand-logo-type"><img className="brand-logo-image" src={storeContent?.settings?.logoUrl || "/images/saltlyne-logo-black.png"} alt="Saltlyne" /><small>LABEL</small></span>
                        </Link>
                        <button className={`art-mode-toggle ${artMode ? "is-active" : ""}`} type="button" role="switch" aria-checked={artMode} aria-label={artMode ? "Turn off Art Mode" : "Turn on Art Mode"} onClick={() => setArtMode((enabled) => !enabled)}>
                            <span className="art-mode-emblem" aria-hidden="true">
                                <svg className="art-mode-sun" viewBox="0 0 40 40">
                                    <circle cx="20" cy="20" r="5.2"/>
                                    <path d="M20 3.6v5.2M20 31.2v5.2M3.6 20h5.2M31.2 20h5.2M8.4 8.4l3.7 3.7m15.8 15.8 3.7 3.7m0-23.2-3.7 3.7m-15.8 15.8-3.7 3.7"/>
                                </svg>
                                <svg className="art-mode-moon" viewBox="0 0 40 40">
                                    <path d="M25.9 25.1A13.4 13.4 0 0 1 14.8 7.6 13.5 13.5 0 1 0 32.4 24a13.2 13.2 0 0 1-6.5 1.1Z"/>
                                    <path d="m27.5 6.3.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9.9-2.4ZM10 17.3l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Zm20.7 12.1.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3Z"/>
                                </svg>
                            </span>
                        </button>
                    </div>
                    <div className="header-actions">
                        <button className={`header-icon search-icon ${searchOpen ? "search-active" : ""}`} type="button" onClick={() => { setSearchOpen(!searchOpen); setSearchTerm(""); }} aria-expanded={searchOpen} aria-controls="store-search" aria-label={searchOpen ? "Close search" : "Search the collection"}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg></button>
                        <Link className="header-icon account-header-icon" to="/account" viewTransition state={signedInCustomer ? { customer: signedInCustomer } : undefined} aria-label={signedInCustomer ? `Account, ${signedInCustomer.name}` : "Account"}>{signedInCustomer
                            ? <ProfileBadge firstName={signedInCustomer.firstName} lastName={signedInCustomer.lastName}/>
                            : <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5"/><path d="M4.5 21c.5-4.2 3.1-6.5 7.5-6.5s7 2.3 7.5 6.5"/></svg>}</Link>
                        <button className="header-icon bag-icon" type="button" onClick={() => setCartOpen(true)} aria-label={`Shopping bag, ${cartCount} items`} aria-expanded={cartOpen} aria-controls="cart-drawer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><span className="bag-count">{cartCount}</span></button>
                    </div>
            </header>
                <section className={`store-search ${searchOpen ? "is-open" : ""}`} id="store-search" aria-label="Search Saltlyne collections" aria-hidden={!searchOpen} inert={!searchOpen}>
                    <label className="search-label" htmlFor="collection-search">SEARCH THE COLLECTION</label>
                    <div className="search-field-wrap"><svg className="search-field-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg><input ref={searchInput} id="collection-search" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }} placeholder="Try leggings, coastal run, or new arrivals" autoComplete="off"/><kbd>ESC</kbd><button className="search-close" type="button" onClick={() => setSearchOpen(false)} aria-label="Close search">×</button></div>
                    <div className="search-results" aria-live="polite">{searchTerms.length ? searchResults.length ? searchResults.map((result) => <Link className="search-result" to={result.href} key={result.title} onClick={(event) => { event.currentTarget.blur(); setSearchOpen(false); }}><span><strong>{result.title}</strong><small>{result.detail}</small></span></Link>) : <p className="search-empty">No matches yet. Try a product or collection name.</p> : <p className="search-hint">Search products, categories, and coastal collections.</p>}</div>
                </section>
            </div>

            <div ref={campaignTrack} className="campaign-scroll-track" id="top">
                <section className="campaign" aria-label="Saltlyne Label campaigns">
                    <div className="campaign-visuals" aria-hidden="true">
                        {campaignSlides.map((item, index) => item.video
                            ? <video key={`${item.eyebrow}-${index}`} className={`campaign-image ${index === activeCampaign ? "is-active" : ""}`} muted autoPlay loop playsInline preload="metadata" poster={imageUrl(item.image, 2200)} aria-label={item.imageAlt}><source src={item.video} type="video/mp4"/></video>
                            : <img key={`${item.eyebrow}-${index}`} className={`campaign-image ${index === activeCampaign ? "is-active" : ""}`} src={imageUrl(item.image, 2200)} alt={item.imageAlt || ""} />)}
                    </div>
                    <div className="campaign-shade" />
                    <div className="campaign-copy" key={activeCampaign} aria-live="polite">
                        <p className="eyebrow">{campaign.eyebrow}</p>
                        <h1>{campaign.title}</h1>
                        <p className="campaign-description">{campaign.description}</p>
                    </div>
                    <div className="campaign-scroll-cue" aria-hidden="true">
                        <span>SCROLL TO EXPLORE</span>
                        <i />
                        <span>{String(activeCampaign + 1).padStart(2, "0")} / {String(campaignSlides.length).padStart(2, "0")}</span>
                    </div>
                </section>
            </div>

            <section className="manifesto" aria-labelledby="manifesto-title">
                <p className="eyebrow">{manifesto.eyebrow}</p>
                <h2 id="manifesto-title">{(manifesto.headlineLines || []).map((line, index) => {
                    const emphasisIndex = line.indexOf(manifesto.emphasis || "");
                    return <React.Fragment key={`${line}-${index}`}>{index > 0 && <br/>}{emphasisIndex >= 0 && manifesto.emphasis ? <>{line.slice(0, emphasisIndex)}<em>{manifesto.emphasis}</em>{line.slice(emphasisIndex + manifesto.emphasis.length)}</> : line}</React.Fragment>;
                })}</h2>
                <p>{manifesto.body}</p>
                <Link to={manifesto.buttonLink || "/explore"} onClick={rememberExploreScroll} aria-label={manifesto.buttonText || "Explore the Saltlyne collection"}>{manifesto.buttonText} </Link>
            </section>

            <section className="our-story-section" id="story" aria-labelledby="our-story-title">
                <div className="our-story-inner">
                    <div className="our-story-guide">
                        <h2 id="our-story-title" className="our-story-heading">OUR STORY</h2>
                        <p className="our-story-prompt">A journey back to yourself. Choose a chapter or scroll to continue.</p>
                        <nav className="our-story-chapter-nav" aria-label="Our story chapters">
                            {story.map((chapter, index) => <button
                                key={chapter.title}
                                type="button"
                                data-story-chapter-control={index}
                                aria-label={`Read chapter ${index + 1}: ${chapter.title}`}
                                onClick={() => storyScroller.current?.querySelector(`[data-story-chapter="${index}"]`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })}
                            >
                                <span>{String(index + 1).padStart(2, "0")}</span>
                                <span>{chapter.title}</span>
                            </button>)}
                        </nav>
                    </div>
                    <div className="our-story-scroll" ref={storyScroller} aria-label="Our story. Scroll to read each chapter.">
                        <div className="our-story-copy" aria-hidden="true">
                            {story.map((chapter, chapterIndex) => <section className="our-story-chapter" data-story-chapter={chapterIndex} key={chapter.title}>
                                <div className="our-story-chapter-heading">
                                    <span>{String(chapterIndex + 1).padStart(2, "0")}</span>
                                    <h3>{chapter.title}</h3>
                                </div>
                                {chapter.blocks.map((block, blockIndex) => {
                                    const TextTag = block.type === "quote" ? "blockquote" : "p";
                                    const className = block.type === "closing" ? "our-story-closing" : undefined;
                                    return <TextTag className={className} key={`${chapter.title}-${blockIndex}`}>{Array.from(block.text, (character, characterIndex) => <span data-story-character key={characterIndex}>{character}</span>)}</TextTag>;
                                })}
                            </section>)}
                        </div>
                        <div className="sr-only">
                            {story.map((chapter) => <section key={chapter.title}>
                                <h3>{chapter.title}</h3>
                                {chapter.blocks.map((block, index) => block.type === "quote"
                                    ? <blockquote key={index}>{block.text}</blockquote>
                                    : <p key={index}>{block.text}</p>)}
                            </section>)}
                        </div>
                    </div>
                    <div className="our-story-scroll-progress" role="progressbar" aria-label="Story reading progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span /></div>
                </div>
            </section>

            <section className="club-membership" id="new" aria-labelledby="club-membership-title">
                <div className="club-membership-image">
                    <img src={imageUrl(membership.imageUrl, 1400)} alt={membership.imageAlt} loading="lazy" />
                    <span className="club-membership-image-label">SALTLYNE · FIND YOUR CURRENT</span>
                </div>
                <div className="club-membership-copy">
                    <p className="eyebrow">{membership.eyebrow}</p>
                    <h2 id="club-membership-title">{(membership.headlineLines || []).map((line, index) => {
                        const emphasisIndex = line.indexOf(membership.emphasis || "");
                        return <React.Fragment key={`${line}-${index}`}>{index > 0 && <br/>}{emphasisIndex >= 0 && membership.emphasis ? <>{line.slice(0, emphasisIndex)}<em>{membership.emphasis}</em>{line.slice(emphasisIndex + membership.emphasis.length)}</> : line}</React.Fragment>;
                    })}</h2>
                    <p>{membership.body}</p>
                    <a className="club-membership-join" href="#newsletter">{membership.buttonText}</a>
                    <span className="club-membership-note">{membership.note}</span>
                </div>
            </section>

            <section className="newsletter" id="newsletter">
                <p className="eyebrow">{newsletter.eyebrow}</p>
                <h2>{(newsletter.headlineLines || []).map((line, index) => <React.Fragment key={`${line}-${index}`}>{index > 0 && <br/>}{line}</React.Fragment>)}</h2>
                <p>{newsletter.body}</p>
                <form onSubmit={submitNewsletter}>
                    <label className="sr-only" htmlFor="email-address">Email address</label>
                    <input id="email-address" type="email" placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)} required/>
                    <label className="newsletter-consent"><input type="checkbox" name="newsletter-consent" required/> I agree to receive occasional Saltlyne email updates. I can unsubscribe at any time.</label>
                    <button type="submit" disabled={subscribed}>{subscribed ? "You’re on the list ✓" : newsletter.buttonText}</button>
                </form>
                {newsletterError && <small className="newsletter-error" role="alert">{newsletterError}</small>}
                {newsletterDeliveryError && <small className="newsletter-error" role="alert">You’re subscribed, but the welcome email could not be sent. Please contact <a href="mailto:support@saltlyne.com">support@saltlyne.com</a>.</small>}
                <small>{subscribed ? "Keep an eye on your inbox. Each newsletter includes an unsubscribe link." : newsletter.consentText}</small>
            </section>

            <StoreFooter logoUrl={storeContent?.settings?.logoUrl} socialIcons={storeContent?.settings?.social} paymentIcons={storeContent?.paymentIcons} showPaymentMethods={false} homePageLayout/>
            <div className={`cart-backdrop ${cartOpen ? "is-open" : ""}`} onClick={() => setCartOpen(false)} aria-hidden={!cartOpen} />
            <aside className={`cart-drawer ${cartOpen ? "is-open" : ""}`} id="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" aria-hidden={!cartOpen} inert={!cartOpen}>
                <div className="cart-drawer-header"><div><p className="eyebrow">YOUR SELECTION</p><h2 id="cart-title">Your bag <span>({cartCount})</span></h2></div><button type="button" className="cart-close" onClick={() => setCartOpen(false)} aria-label="Close bag">×</button></div>
                {cartItems.length ? <>
                    <div className="cart-items">{cartItems.map((item) => <article className="cart-item" key={`${item.id || item.name}-${item.size || "default"}`}><img src={imageUrl(item.image, 240)} alt=""/><div className="cart-item-info"><h3>{item.name}</h3><p>{item.size ? `Size ${item.size} · ` : ""}{item.tone} · Saltlyne Label</p><strong>{formatMoney(item.priceValue)}</strong><div className="cart-item-controls"><div className="quantity-control"><button type="button" onClick={() => changeQuantity(item, -1)} aria-label={`Reduce ${item.name} quantity`}>−</button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item, 1)} aria-label={`Increase ${item.name} quantity`}>+</button></div><button className="remove-item" type="button" onClick={() => removeItem(item)}>Remove</button></div></div></article>)}</div>
                    <div className="cart-summary"><div><span>Subtotal</span><strong>{formatMoney(cartTotal)}</strong></div><p>Shipping and taxes are calculated at checkout.</p><button className="cart-checkout" type="button" onClick={() => { setCartOpen(false); navigate("/checkout"); }}>Proceed to checkout </button><button className="continue-shopping" type="button" onClick={() => setCartOpen(false)}>Continue shopping</button></div>
                </> : <div className="cart-empty"><span className="cart-empty-mark">S</span><h3>Your bag is taking it slow.</h3><p>Once you find your favourites, they’ll be waiting here.</p><button type="button" className="cart-checkout" onClick={() => setCartOpen(false)}>Explore the collection </button></div>}
            </aside>
        </main>
    );
}
