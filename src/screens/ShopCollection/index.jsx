import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useCart } from "../../context/CartContext";
import { api } from "../../lib/api";
import { fallbackCatalog, mergeCatalog } from "../../lib/catalog";
import { storeImageUrl } from "../../lib/images";
import { useStoreContent } from "../../lib/useStoreContent";
import { rememberExploreScroll } from "../../lib/exploreNavigation";
import { slugify } from "../../../shared/catalog.js";
import PaymentMethodMarks from "../../components/PaymentMethodMarks";
import "./style.css";

const titles = { women: "Women", men: "Men", accessories: "Accessories" };
const apparelSizes = ["XS", "S", "M", "L", "XL", "XXL"];
const fitPieceOrder = ["everyday-form-bra", "studio-rib-tank", "move-with-ease-short", "sculpt-seamless-leggings", "elephant-trail-flare-leggings"];
const fitColors = [
    { name: "Black", value: "#111315", outline: "light" },
    { name: "Maroon", value: "#70243a", outline: "light" },
    { name: "Teal", value: "#26312b", outline: "light" },
    { name: "Dark Blue", value: "#172c59", outline: "light" },
    { name: "Baby Blue", value: "#9ecde4", outline: "light" },
    { name: "White", value: "#f7f6f2", outline: "dark" },
];
function fitAreaFor(product) {
    const category = String(product?.category || "").toLowerCase();
    return /bra|top|tank|layer|jacket/.test(category) ? "upper" : "lower";
}
const descriptions = {
    women: "Made for coastal miles, studio hours and everything that feels like you.",
    men: "Built for the work, the recovery and every mile in between.",
    accessories: "The useful little details for wherever the day takes you.",
};
const landingContent = {
    women: {
        eyebrow: "THE COASTAL MOVEMENT EDIT",
        headline: <>Find your<br/><em>own current.</em></>,
        image: "/images/women-galle-hero.jpg",
        imageAlt: "Saltlyne activewear on the Galle coastline",
        sections: [
            {
                title: "Featured collections",
                cards: [
                    { name: "Megan Thee Stallion Does Gym", filter: "collection=sculpt-seamless", image: "/images/women-featured-megan.jpg" },
                    { name: "Lift Seamless 2.0", filter: "collection=sculpt-seamless", image: "/images/women-featured-lift-seamless.jpg" },
                    { name: "Everyday Seamless", filter: "collection=everyday-essentials", image: "/images/women-featured-everyday-seamless.jpg" },
                    { name: "SoftSense", filter: "collection=everyday-essentials", image: "/images/women-featured-softsense.jpg" },
                ],
            },
            {
                title: "How do you train?",
                cards: [
                    { name: "LIFTING", filter: "activity=train", image: "/images/women-train-lifting.jpg" },
                    { name: "HIIT", filter: "activity=train", image: "/images/women-train-hiit.jpg" },
                    { name: "RUNNING", filter: "activity=run", image: "/images/women-train-running.jpg" },
                    { name: "PILATES", filter: "activity=studio", image: "/images/women-train-pilates.jpg" },
                ],
            },
        ],
        editorial: [
            { title: "Women’s gym and workout clothes", text: "Discover comfortable activewear for your personal best, whether that means training hard, getting outside or finding a little time for yourself. Explore considered essentials designed for movement, with easy-to-wear fits for every day." },
            { title: "Workout clothes built for movement", text: "From supportive sports bras and flexible leggings to versatile tops and layers, find the pieces you need to move with confidence. Thoughtful details and comfortable fabrics help you stay focused from warm-up through recovery." },
            { title: "Shop women’s activewear", text: "Build a wardrobe that works for your routine. Choose pieces for lifting, HIIT, running, Pilates or rest days, and find the fit and feel that helps you move your way." },
        ],
    },
    men: {
        eyebrow: "MADE FOR THE MILES AHEAD",
        headline: <>Move with<br/><em>intent.</em></>,
        image: "/images/men-galle-run.jpg",
        imageAlt: "Saltlyne training on the Galle Fort coast",
        sections: [
            {
                title: "Trending right now",
                cards: [
                    {
                        name: "Power",
                        description: "Timeless, tireless and built to work just as hard as you do.",
                        filter: "activity=train",
                        image: "/images/men-trending-power.jpg",
                    },
                    {
                        name: "Train",
                        description: "Reliable staples you’ll wear again and again",
                        filter: "activity=train",
                        image: "/images/men-trending-train.jpg",
                    },
                    {
                        name: "Tracksuits",
                        description: "Lifestyle & sportswear fashion collide to create the ultimate rest day uniform.",
                        filter: "category=layers",
                        image: "/images/men-trending-tracksuits.jpg",
                    },
                    {
                        name: "Running",
                        description: "Comfy, breathable kit that keeps your focus where you need it.",
                        filter: "activity=run",
                        image: "/images/men-trending-running.jpg",
                    },
                ],
            },
            {
                title: "How do you train?",
                cards: [
                    {
                        name: "LIFTING",
                        filter: "activity=train",
                        image: "/images/men-train-lifting.jpg",
                    },
                    {
                        name: "RUNNING",
                        filter: "activity=run",
                        image: "/images/men-train-running.jpg",
                    },
                    {
                        name: "HIIT",
                        filter: "activity=train",
                        image: "/images/men-train-hiit.jpg",
                    },
                    {
                        name: "REST DAY",
                        filter: "activity=everyday",
                        image: "/images/men-train-rest.jpg",
                    },
                ],
            },
        ],
        editorial: [
            { title: "Men’s gym and workout clothes", text: "Find versatile activewear designed to move with you from focused training sessions to the miles in between. Explore considered essentials made for comfort, performance and everyday wear." },
            { title: "Training clothes made to move", text: "Build your training wardrobe with easy-wearing tops, shorts, tights and layers. Each piece is designed to support your movement and keep you comfortable from warm-up through recovery." },
            { title: "Shop men’s activewear", text: "Whether you’re lifting, running or taking a rest day, find the pieces that work for your routine. Discover reliable fits and coastal-inspired essentials made for wherever the day takes you." },
        ],
    },
    accessories: {
        eyebrow: "THE FINISHING DETAILS",
        headline: <>Ready for<br/><em>what's next.</em></>,
        image: "/images/coastal-training-accessories.jpg",
        imageAlt: "Saltlyne essentials for training and coastal escapes",
        sections: [{
            title: "Shop by category",
            cards: [
                { name: "Bags", filter: "category=bags", image: "/images/coastal-training-accessories.jpg" },
                { name: "Socks", filter: "category=socks", image: "/images/coastal-training-accessories.jpg" },
                { name: "Headwear", filter: "category=headwear", image: "/images/men-galle-run.jpg" },
                { name: "Equipment", filter: "category=equipment", image: "/images/coastal-training-accessories.jpg" },
                { name: "Underwear", filter: "category=underwear", image: "/images/men-solo-kettlebell.jpg" },
            ],
        }],
        editorial: [
            { title: "Accessories for training and every day", text: "Explore the finishing details that make your routine work better. From useful carry options to everyday essentials, find considered accessories for training, travel and time by the coast." },
            { title: "The details that go further", text: "Keep your essentials close with practical accessories designed to fit into your day. Choose easy-to-use pieces for the gym, your commute or the next stop on your coastal escape." },
            { title: "Shop Saltlyne accessories", text: "Find bags, socks, headwear, equipment and more to complement the way you move. Discover versatile details made for wherever life takes you." },
        ],
    },
};
function effectivePrice(product) {
    return product.onSale && Number(product.salePrice) > 0 && Number(product.salePrice) < Number(product.price)
        ? Number(product.salePrice)
        : Number(product.price);
}

function uniqueValues(items, key) {
    return [...new Set(items.flatMap((item) => Array.isArray(item[key]) ? item[key] : [item[key]]).filter(Boolean))];
}

function LandingCategorySection({ section, gender }) {
    const gridRef = useRef(null);
    const dragRef = useRef(false);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [thumbSize, setThumbSize] = useState(100);
    const isScrollable = section.cards.length > 4;
    const gridId = `landing-grid-${gender}-${slugify(section.title)}`;

    useEffect(() => {
        const grid = gridRef.current;
        if (!isScrollable || !grid) return undefined;

        const updateProgress = () => {
            const scrollableDistance = grid.scrollWidth - grid.clientWidth;
            setThumbSize(scrollableDistance > 0 ? Math.max(10, (grid.clientWidth / grid.scrollWidth) * 100) : 100);
            setScrollProgress(scrollableDistance > 0 ? Math.max(0, Math.min(1, grid.scrollLeft / scrollableDistance)) : 0);
        };
        updateProgress();
        grid.addEventListener("scroll", updateProgress, { passive: true });
        window.addEventListener("resize", updateProgress);
        return () => {
            grid.removeEventListener("scroll", updateProgress);
            window.removeEventListener("resize", updateProgress);
        };
    }, [isScrollable]);

    const scrollToPointer = (event) => {
        const grid = gridRef.current;
        const track = event.currentTarget.getBoundingClientRect();
        if (!grid || track.width <= 0) return;
        const thumbTravel = track.width * (1 - thumbSize / 100);
        const thumbOffset = Math.max(0, Math.min(thumbTravel, event.clientX - track.left - (track.width * thumbSize / 200)));
        const scrollableDistance = grid.scrollWidth - grid.clientWidth;
        grid.scrollLeft = thumbTravel > 0 ? (thumbOffset / thumbTravel) * scrollableDistance : 0;
    };

    const handleTrackKeyDown = (event) => {
        const grid = gridRef.current;
        if (!grid) return;
        const scrollableDistance = grid.scrollWidth - grid.clientWidth;
        const step = Math.max(80, grid.clientWidth * 0.2);
        let nextScroll = null;
        if (event.key === "ArrowRight" || event.key === "PageDown") nextScroll = grid.scrollLeft + step;
        if (event.key === "ArrowLeft" || event.key === "PageUp") nextScroll = grid.scrollLeft - step;
        if (event.key === "Home") nextScroll = 0;
        if (event.key === "End") nextScroll = scrollableDistance;
        if (nextScroll === null) return;
        event.preventDefault();
        grid.scrollTo({ left: nextScroll, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };

    return <section className={`shop-landing-categories ${isScrollable ? "shop-landing-scrollable" : ""}`} aria-label={section.title}>
        <div className="shop-landing-heading"><div><h2>{section.title}</h2></div></div>
        <div className="shop-landing-grid" id={gridId} ref={gridRef}>{section.cards.map((card) => <Link className="shop-landing-card" to={`/collections/${gender}?${card.filter}`} key={card.name}>
            <img src={storeImageUrl(card.image, 1000)} alt="" loading="lazy"/>
            <span className="shop-landing-card-shade"/>
            <span className="shop-landing-card-copy"><strong>{card.name}</strong>{card.description && <p>{card.description}</p>}</span>
        </Link>)}</div>
        {isScrollable && <div
            className="shop-landing-scroll-indicator"
            role="scrollbar"
            aria-label={`Scroll ${section.title}`}
            aria-controls={gridId}
            aria-orientation="horizontal"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(scrollProgress * 100)}
            tabIndex={0}
            onKeyDown={handleTrackKeyDown}
            onPointerDown={(event) => {
                dragRef.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                scrollToPointer(event);
            }}
            onPointerMove={(event) => { if (dragRef.current) scrollToPointer(event); }}
            onPointerUp={() => { dragRef.current = false; }}
            onPointerCancel={() => { dragRef.current = false; }}
        >
            <span className="shop-landing-scroll-beam" style={{ width: `${thumbSize}%`, left: `${scrollProgress * (100 - thumbSize)}%` }}/>
        </div>}
    </section>;
}

export default function ShopCollection() {
    const { gender: routeGender = "women" } = useParams();
    const gender = Object.hasOwn(titles, routeGender) ? routeGender : "women";
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState(fallbackCatalog);
    const { addItem, count, formatMoney } = useCart();
    const [selectedSizes, setSelectedSizes] = useState({});
    const { content: storeContent } = useStoreContent();
    const [, setCatalogError] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [tryOnProductId, setTryOnProductId] = useState("");
    const [fitModelSize, setFitModelSize] = useState("M");
    const [fitSelectionProductId, setFitSelectionProductId] = useState("elephant-trail-flare-leggings");
    const [fitUpperProductId, setFitUpperProductId] = useState("everyday-form-bra");
    const [fitLowerProductId, setFitLowerProductId] = useState("elephant-trail-flare-leggings");
    const [fitColorsByProduct, setFitColorsByProduct] = useState({});
    const [fitZoomArea, setFitZoomArea] = useState("");
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [galleryCanNext, setGalleryCanNext] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const galleryTrack = useRef(null);
    const dragState = useRef({ active: false, moved: false, suppressClick: false, startX: 0, startScroll: 0 });
    const params = Object.fromEntries(searchParams.entries());
    const isFeaturedEdit = params.featured === "1";
    const isCollectionLanding = Object.keys(params).length === 0;
    const fallbackLanding = landingContent[gender];
    const categoryContent = storeContent?.categories?.find((category) => category.slug === gender);
    const pageTitle = categoryContent?.title || titles[gender];
    const navigationCategories = (storeContent?.categories ?? [{ slug: "women", title: "Women" }, { slug: "men", title: "Men" }, { slug: "accessories", title: "Accessories" }])
        .filter((category) => category.active !== false)
        .slice()
        .sort((left, right) => Number(left.displayOrder || 0) - Number(right.displayOrder || 0));
    const landing = categoryContent ? {
        ...fallbackLanding,
        eyebrow: categoryContent.eyebrow || fallbackLanding.eyebrow,
        headline: categoryContent.headlineLines?.length ? <>{categoryContent.headlineLines.map((line, index) => {
            const emphasisIndex = line.indexOf(categoryContent.emphasis || "");
            return <React.Fragment key={`${line}-${index}`}>{index > 0 && <br/>}{emphasisIndex >= 0 && categoryContent.emphasis ? <>{line.slice(0, emphasisIndex)}<em>{categoryContent.emphasis}</em>{line.slice(emphasisIndex + categoryContent.emphasis.length)}</> : line}</React.Fragment>;
        })}</> : fallbackLanding.headline,
        image: categoryContent.imageUrl || fallbackLanding.image,
        imageAlt: categoryContent.imageAlt || fallbackLanding.imageAlt,
        description: categoryContent.description || descriptions[gender],
    } : fallbackLanding;
    const genderProducts = products.filter((product) => product.gender === gender && product.active !== false);
    const hasSalesRanking = genderProducts.some((product) => product.isBestSeller || product.bestSeller);
    const categories = uniqueValues(genderProducts, "category").sort();
    const collections = uniqueValues(genderProducts, "collection").sort();
    const activities = uniqueValues(genderProducts, "activity").sort();
    const sizes = [...apparelSizes, ...uniqueValues(genderProducts, "sizes").filter((size) => !apparelSizes.includes(size)).sort()];
    const tryOnProduct = genderProducts.find((product) => product.id === tryOnProductId);
    const fitWardrobeProducts = gender === "women"
        ? fitPieceOrder.map((id) => products.find((product) => product.id === id) || fallbackCatalog.find((product) => product.id === id)).filter(Boolean)
        : [];
    const fitSelectionProduct = fitWardrobeProducts.find((product) => product.id === fitSelectionProductId) || fitWardrobeProducts[0];
    const fitUpperProduct = fitWardrobeProducts.find((product) => product.id === fitUpperProductId) || fitWardrobeProducts.find((product) => fitAreaFor(product) === "upper");
    const fitLowerProduct = fitWardrobeProducts.find((product) => product.id === fitLowerProductId) || fitWardrobeProducts.find((product) => fitAreaFor(product) === "lower");
    const fitModelIndex = Math.max(0, apparelSizes.indexOf(fitModelSize));
    const fitModelStyle = { "--fit-x": `${(fitModelIndex % 3) * 50}%`, "--fit-y": fitModelIndex > 2 ? "100%" : "0%" };
    const getFitColor = (product) => fitColors.find((color) => color.name === fitColorsByProduct[product?.id]) || fitColors[0];
    const getFitVariantSrc = (product, color = getFitColor(product)) => `/images/fit-variants/${product.id}/${slugify(color.name)}.${color.name === "Teal" ? "png" : "webp"}`;
    const getFitModelSheet = (product) => product
        ? `/images/fit-model-variants/${product.id}-${slugify(getFitColor(product).name)}.${getFitColor(product).name === "Teal" ? "png" : "webp"}`
        : "/images/fit-models-women.png";
    const getFitModelLayerStyle = (product) => ({
        ...fitModelStyle,
        backgroundImage: `url("${getFitModelSheet(product)}")`,
    });
    const selectFitPiece = (product, color) => {
        setFitSelectionProductId(product.id);
        if (fitAreaFor(product) === "upper") setFitUpperProductId(product.id);
        else setFitLowerProductId(product.id);
        if (color) setFitColorsByProduct((current) => ({ ...current, [product.id]: color }));
    };

    const getProductSizes = (product) => Array.isArray(product.sizes) ? product.sizes : [];
    const getSelectedSize = (product) => {
        const available = getProductSizes(product);
        if (available.includes(selectedSizes[product.id])) return selectedSizes[product.id];
        const filteredSize = available.find((size) => slugify(size) === params.size);
        return filteredSize || (available.includes("M") ? "M" : available[0] || "");
    };
    const setProductSize = (product, size) => setSelectedSizes((current) => ({ ...current, [product.id]: size }));
    const addProductToBag = (product) => {
        const size = getSelectedSize(product);
        if (!size || Number(product.stock) <= 0) return;
        addItem({ ...product, size, priceValue: effectivePrice(product) });
    };
    const colors = uniqueValues(genderProducts, "colors").sort();

    useEffect(() => {
        let current = true;
        api("/products").then((items) => { if (current && Array.isArray(items)) setProducts(mergeCatalog(items)); }).catch((error) => { if (current) setCatalogError(error.message); });
        return () => { current = false; };
    }, []);

    useEffect(() => {
        if (!tryOnProductId && !fitZoomArea) return undefined;
        const closeOnEscape = (event) => { if (event.key === "Escape") { setTryOnProductId(""); setFitZoomArea(""); } };
        window.addEventListener("keydown", closeOnEscape);
        document.body.classList.add("fit-preview-open");
        return () => {
            window.removeEventListener("keydown", closeOnEscape);
            document.body.classList.remove("fit-preview-open");
        };
    }, [tryOnProductId, fitZoomArea]);

    const filteredProducts = useMemo(() => {
        let result = genderProducts.filter((product) => {
            if (params.category && slugify(product.category) !== params.category) return false;
            if (params.subcategory && slugify(product.subcategory) !== params.subcategory) return false;
            if (params.collection && slugify(product.collection) !== params.collection) return false;
            if (params.activity && slugify(product.activity) !== params.activity) return false;
            if (params.size && !(product.sizes || []).some((size) => slugify(size) === params.size)) return false;
            if (params.color && !(product.colors || []).some((color) => slugify(color) === params.color)) return false;
            if (params.available === "1" && Number(product.stock) <= 0) return false;
            if (params.sale === "1" && !product.onSale) return false;
            if (params.min && effectivePrice(product) < Number(params.min)) return false;
            if (params.max && effectivePrice(product) > Number(params.max)) return false;
            if (params.featured === "1" && gender === "women" && !fitPieceOrder.includes(product.id)) return false;
            if (params.featured === "1" && !product.featured) return false;
            if (params.sort === "trending" && !product.isTrending) return false;
            if (params.sort === "best-sellers" && hasSalesRanking && !(product.isBestSeller || product.bestSeller)) return false;
            return true;
        });

        switch (params.sort) {
            case "best-sellers":
                result.sort((a, b) => Number(Boolean(b.bestSeller)) - Number(Boolean(a.bestSeller)) || Number(b.unitsSold || 0) - Number(a.unitsSold || 0));
                break;
            case "trending":
                result.sort((a, b) => Number(b.unitsSold || 0) - Number(a.unitsSold || 0));
                break;
            case "price-low": result.sort((a, b) => effectivePrice(a) - effectivePrice(b)); break;
            case "price-high": result.sort((a, b) => effectivePrice(b) - effectivePrice(a)); break;
            case "newest": result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)); break;
            case "featured": result.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))); break;
            default: result.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Number(b.unitsSold || 0) - Number(a.unitsSold || 0));
        }
        return result;
    }, [genderProducts, params, hasSalesRanking, gender]);

    const filteredProductIds = filteredProducts.map((product) => product.id).join("|");

    function updateGalleryPosition() {
        const track = galleryTrack.current;
        if (!track) return;
        const slides = [...track.querySelectorAll(".shop-product-card")];
        const trackLeft = track.getBoundingClientRect().left;
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;
        slides.forEach((slide, index) => {
            const distance = Math.abs(slide.getBoundingClientRect().left - trackLeft);
            if (distance < closestDistance) { closestDistance = distance; closestIndex = index; }
        });
        setGalleryIndex(closestIndex);
        setGalleryCanNext(track.scrollLeft < track.scrollWidth - track.clientWidth - 3);
    }

    function scrollGallery(direction) {
        const track = galleryTrack.current;
        const slide = track?.querySelector(".shop-product-card");
        if (!track || !slide) return;
        const computedGap = window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap;
        const gap = Number.parseFloat(computedGap) || 0;
        track.scrollBy({ left: direction * (slide.getBoundingClientRect().width + gap), behavior: "smooth" });
    }

    function startMouseDrag(event) {
        if (event.pointerType !== "mouse" || event.button !== 0 || event.target.closest("button, a, input, select, textarea")) return;
        const track = galleryTrack.current;
        if (!track) return;
        dragState.current = { active: true, moved: false, suppressClick: false, startX: event.clientX, startScroll: track.scrollLeft };
        setIsDragging(true);
        track.setPointerCapture(event.pointerId);
    }

    function moveMouseDrag(event) {
        if (!dragState.current.active || event.pointerType !== "mouse") return;
        const distance = event.clientX - dragState.current.startX;
        if (Math.abs(distance) > 5) dragState.current.moved = true;
        if (dragState.current.moved && galleryTrack.current) {
            event.preventDefault();
            galleryTrack.current.scrollLeft = dragState.current.startScroll - distance;
        }
    }

    function stopMouseDrag() {
        if (!dragState.current.active) return;
        dragState.current.suppressClick = dragState.current.moved;
        dragState.current.active = false;
        setIsDragging(false);
        window.setTimeout(() => { dragState.current.suppressClick = false; }, 0);
        updateGalleryPosition();
    }

    useEffect(() => {
        const track = galleryTrack.current;
        if (!track) return;
        track.scrollTo({ left: 0, behavior: "smooth" });
        setGalleryIndex(0);
        window.requestAnimationFrame(updateGalleryPosition);
    }, [filteredProductIds]);

    function setFilter(key, value) {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(key, value);
        else next.delete(key);
        setSearchParams(next, { replace: false });
    }

    function clearFilters() { setSearchParams(new URLSearchParams(), { replace: false }); }
    const categoryHref = (category) => `/collections/${gender}?category=${slugify(category)}`;

    return <main className="shop-page">
        <div className="shop-announcement">{storeContent?.settings?.siteAnnouncement?.label || "SALTLYNE LABEL"} <span>·</span> {storeContent?.settings?.siteAnnouncement?.text || "CLOTHES FOR WHEREVER LIFE TAKES YOU"}</div>
        <header className="shop-header"><Link className="shop-logo" to="/" viewTransition><img className="brand-logo-image" src={storeContent?.settings?.logoUrl || "/images/saltlyne-logo-black.png"} alt="Saltlyne"/><small>LABEL</small></Link><Link className="shop-bag" to="/checkout" viewTransition aria-label={`Shopping bag with ${count} items`}><span>Bag</span><b>{count}</b></Link></header>
        <nav className="shop-main-navigation" aria-label="Main navigation">
            {navigationCategories.map((category) => <Link key={category.slug} className={gender === category.slug ? "selected" : ""} to={`/collections/${category.slug}`} viewTransition>{category.title || category.label}</Link>)}
            <Link to="/explore" viewTransition onClick={rememberExploreScroll}>Explore</Link>
        </nav>

        <section className={`shop-collection-intro intro-${gender} ${isCollectionLanding ? "shop-landing-hero" : ""}`}>
            {isCollectionLanding && <img className="shop-landing-image" src={storeImageUrl(landing.image, 2200)} alt={landing.imageAlt}/>}
            <div><p className="shop-eyebrow">{isCollectionLanding ? landing.eyebrow : gender === "accessories" ? "THE EXTRAS" : "COASTAL ACTIVEWEAR"}</p><h1>{isCollectionLanding ? landing.headline : <>{pageTitle}<br/><em>Collection</em></>}</h1><p>{isCollectionLanding ? landing.description || descriptions[gender] : descriptions[gender]}</p><div className="shop-intro-links"><Link to={`/collections/${gender}?featured=1`}>Shop featured edit </Link><Link to={`/collections/${gender}?sort=best-sellers`}>Shop best sellers </Link></div></div>
            <div className="shop-intro-note"><span>01 / 03</span><p>Made with movement<br/>and the coast in mind.</p></div>
        </section>

        {isCollectionLanding && <div className={`shop-landing-collections landing-${gender}`}>
            {landing.sections.map((section) => <LandingCategorySection section={section} gender={gender} key={section.title}/>)}
        </div>}

        {isCollectionLanding && <section className="collection-landing-editorial" aria-label={`About Saltlyne ${pageTitle.toLowerCase()}`}>
            {landing.editorial.map((item) => <article key={item.title}>
                <h2>{item.title}</h2>
                <p>{item.text}</p>
            </article>)}
        </section>}

        {!isCollectionLanding && <nav className="shop-category-chips" aria-label={`${pageTitle} product categories`}>
            <Link className={!params.category ? "active" : ""} to={`/collections/${gender}`}>All {pageTitle}</Link>
            {categories.map((category) => <Link className={params.category === slugify(category) ? "active" : ""} to={categoryHref(category)} key={category}>{category}</Link>)}
            <Link className={params.sale === "1" ? "active" : ""} to={`/collections/${gender}?sale=1`}>Last chance</Link>
        </nav>}

        {!isCollectionLanding && gender === "women" && !isFeaturedEdit && <section className="fit-studio" id="fit-studio" aria-labelledby="fit-studio-title">
            <div className="fit-studio-heading"><p className="shop-eyebrow">SIZE INCLUSIVITY</p><h2 id="fit-studio-title">Find your <em>fit.</em></h2><p>Choose a size, a piece and a color to see the garment on your fit-reference model.</p></div>
            <div className="fit-studio-stage">
                <div className="fit-studio-model-wrap">
                    <div className="fit-studio-model" style={fitModelStyle} role="img" aria-label={`Adult Sri Lankan fit-reference model wearing selected activewear pieces, size ${fitModelSize}`}>
                        <div key={`${fitLowerProduct?.id}-${getFitColor(fitLowerProduct || fitWardrobeProducts[0]).name}-${fitModelSize}`} className="fit-model-layer fit-model-lower" style={getFitModelLayerStyle(fitLowerProduct)} aria-hidden="true"/>
                        <div key={`${fitUpperProduct?.id}-${getFitColor(fitUpperProduct || fitWardrobeProducts[0]).name}-${fitModelSize}`} className={`fit-model-layer fit-model-upper ${fitUpperProduct?.id === "studio-rib-tank" ? "fit-model-upper-long" : ""}`} style={getFitModelLayerStyle(fitUpperProduct)} aria-hidden="true"/>
                        <button className="fit-hotspot fit-hotspot-top" type="button" onClick={() => setFitZoomArea("top")} aria-label="Zoom in on upper body details"><span>+</span> Upper fit</button>
                        <button className="fit-hotspot fit-hotspot-bottom" type="button" onClick={() => setFitZoomArea("bottom")} aria-label="Zoom in on lower body details"><span>+</span> Lower fit</button>
                    </div>
                    <div className="fit-model-caption"><span>FIT REFERENCE</span><span>SIZE {fitModelSize}</span></div>
                </div>
                <div className="fit-studio-controls"><p className="fit-controls-kicker">SELECT A MODEL</p><h3>Six sizes.<br/>One considered fit.</h3><p className="fit-controls-copy">Tap a piece or color. The selected garment replaces the one in that fit zone.</p><div className="fit-model-sizes" role="group" aria-label="Choose a fit-reference model size">{apparelSizes.map((size, index) => <button key={size} type="button" className={fitModelSize === size ? "selected" : ""} aria-pressed={fitModelSize === size} onClick={() => setFitModelSize(size)}><span>{size}</span><small>MODEL 0{index + 1}</small></button>)}</div></div>
            </div>
            <div className="fit-wardrobe">
                <div className="fit-wardrobe-heading"><div><p className="shop-eyebrow">THE WARDROBE</p><h3>Build your fit</h3></div><span>Choose a piece and its color to update the model fit.</span></div>
                <div className="fit-wardrobe-track">{fitWardrobeProducts.map((product) => {
                    const color = getFitColor(product);
                    const isSelected = fitSelectionProduct?.id === product.id || fitUpperProduct?.id === product.id || fitLowerProduct?.id === product.id;
                    return <article className={`fit-wardrobe-tile ${isSelected ? "selected" : ""}`} key={`${product.id}-${product.subcategory}`}>
                        <button type="button" className="fit-wardrobe-select" onClick={() => selectFitPiece(product)} aria-pressed={isSelected}><span className={`fit-wardrobe-visual fit-wardrobe-visual-${fitAreaFor(product)} fit-wardrobe-visual-${slugify(product.id)}`}><img className="fit-wardrobe-image" src={getFitVariantSrc(product, color)} alt={`${product.name} in ${color.name}`} loading="lazy"/></span><span className="fit-wardrobe-copy"><small>{product.category} · {fitAreaFor(product)} fit</small><strong>{product.name}</strong><span>{formatMoney(effectivePrice(product))} </span></span></button>
                        <div className="fit-color-picker" role="group" aria-label={`Choose ${product.name} colour`}>{fitColors.map((option) => <button type="button" key={option.name} className={`fit-color-swatch ${option.outline} ${color.name === option.name ? "selected" : ""}`} style={{ "--swatch-color": option.value }} onClick={() => selectFitPiece(product, option.name)} aria-label={`${option.name}${color.name === option.name ? ", selected" : ""}`} aria-pressed={color.name === option.name} title={option.name}/>)}</div>
                    </article>;
                })}</div>
            </div>
        </section>}

        {!isCollectionLanding && <div className={`shop-results-layout ${filtersOpen ? "filters-expanded" : "filters-collapsed"}`}>
            {filtersOpen && <aside className="shop-filters" id="collection-filters" aria-label="Filter products">
                <div className="shop-filter-heading"><div><p className="shop-eyebrow">REFINE YOUR EDIT</p><h2>Filters</h2></div><div className="shop-filter-heading-actions"><button className="shop-filter-collapse" type="button" aria-label="Minimize filters" title="Minimize filters" onClick={() => setFiltersOpen(false)}>−</button><button type="button" onClick={clearFilters}>Clear all</button></div></div>
                <label>Category<select value={params.category || ""} onChange={(event) => setFilter("category", event.target.value)}><option value="">All categories</option>{categories.map((category) => <option value={slugify(category)} key={category}>{category}</option>)}</select></label>
                <label>Collection<select value={params.collection || ""} onChange={(event) => setFilter("collection", event.target.value)}><option value="">All collections</option>{collections.map((collection) => <option value={slugify(collection)} key={collection}>{collection}</option>)}</select></label>
                <label>Activity<select value={params.activity || ""} onChange={(event) => setFilter("activity", event.target.value)}><option value="">Any activity</option>{activities.map((activity) => <option value={slugify(activity)} key={activity}>{activity}</option>)}</select></label>
                <label>Subcategory<select value={params.subcategory || ""} onChange={(event) => setFilter("subcategory", event.target.value)}><option value="">All subcategories</option>{uniqueValues(genderProducts, "subcategory").sort().map((item) => <option value={slugify(item)} key={item}>{item}</option>)}</select></label>
                <label>Size<select value={params.size || ""} onChange={(event) => setFilter("size", event.target.value)}><option value="">All sizes</option>{sizes.map((size) => <option value={slugify(size)} key={size}>{size}</option>)}</select></label>
                <label>Colour<select value={params.color || ""} onChange={(event) => setFilter("color", event.target.value)}><option value="">All colours</option>{colors.map((color) => <option value={slugify(color)} key={color}>{color}</option>)}</select></label>
                <fieldset className="shop-price-filter"><legend>Price (USD)</legend><div><label><span className="sr-only">Minimum price</span><input aria-label="Minimum price" type="number" min="0" placeholder="Min" value={params.min || ""} onChange={(event) => setFilter("min", event.target.value)}/></label><span>to</span><label><span className="sr-only">Maximum price</span><input aria-label="Maximum price" type="number" min="0" placeholder="Max" value={params.max || ""} onChange={(event) => setFilter("max", event.target.value)}/></label></div></fieldset>
                <label className="shop-check-filter"><input type="checkbox" checked={params.available === "1"} onChange={(event) => setFilter("available", event.target.checked ? "1" : "")}/> In stock only</label>
                <label className="shop-check-filter"><input type="checkbox" checked={params.featured === "1"} onChange={(event) => setFilter("featured", event.target.checked ? "1" : "")}/> Featured items only</label>
                <label className="shop-check-filter"><input type="checkbox" checked={params.sale === "1"} onChange={(event) => setFilter("sale", event.target.checked ? "1" : "")}/> Last chance / on sale</label>
            </aside>}

            <section className="shop-product-results" aria-live="polite">
                <div className="shop-toolbar"><p><strong>{filteredProducts.length}</strong> pieces in the {pageTitle.toLowerCase()} edit</p><div className="shop-toolbar-controls"><button className="shop-filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls={filtersOpen ? "collection-filters" : undefined} onClick={() => setFiltersOpen((open) => !open)}><span>Filters</span><b aria-hidden="true">{filtersOpen ? "−" : "+"}</b></button><label>Sort by<select aria-label="Sort products" value={params.sort || "featured"} onChange={(event) => setFilter("sort", event.target.value)}><option value="featured">Featured</option><option value="trending">Trending</option><option value="best-sellers">Best sellers</option><option value="newest">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div></div>
                {filteredProducts.length ? <div className="shop-gallery-shell">
                    <button className="shop-gallery-arrow shop-gallery-arrow-prev" type="button" onClick={() => scrollGallery(-1)} disabled={galleryIndex === 0} aria-label="Previous product">‹</button>
                    <div className={`shop-product-track ${isDragging ? "is-dragging" : ""}`} ref={galleryTrack} onScroll={updateGalleryPosition} onPointerDown={startMouseDrag} onPointerMove={moveMouseDrag} onPointerUp={stopMouseDrag} onPointerCancel={stopMouseDrag} onClickCapture={(event) => { if (dragState.current.suppressClick) { event.preventDefault(); event.stopPropagation(); dragState.current.suppressClick = false; } }} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); scrollGallery(1); } if (event.key === "ArrowLeft") { event.preventDefault(); scrollGallery(-1); } }} role="region" aria-label={`${pageTitle} product gallery. Swipe, drag, or use the arrows to browse.`} tabIndex={0}>
                    {filteredProducts.map((product) => {
                    const price = effectivePrice(product);
                    const availableSizes = getProductSizes(product);
                    const selectedSize = getSelectedSize(product);
                    const isApparel = gender !== "accessories";
                    return <article className="shop-product-card" key={product.id}>
                        <div className={`shop-product-image tone-${product.tone || "sand"}`}>{gender === "women" && fitWardrobeProducts.some((piece) => piece.id === product.id) ? <img className="shop-flatlay-image" src={getFitVariantSrc(product)} alt={`${product.name} in ${getFitColor(product).name}`} loading="lazy" draggable="false"/> : gender === "women" ? <img src={storeImageUrl(product.image, 1200)} alt={`${product.name}, product view`} loading="lazy" draggable="false"/> : <img src={storeImageUrl(product.image, 1200)} alt={isApparel ? `${product.name} shown on a model` : product.name} loading="lazy" draggable="false"/>}<div className="shop-model-stamp">{gender === "women" || !isApparel ? "PRODUCT VIEW" : "MODEL VIEW"} <span>·</span> {selectedSize ? `SIZE ${selectedSize}` : "ONE SIZE"}</div><div className="shop-product-badges">{product.featured && <span>Featured</span>}{product.isTrending && <span>Trending</span>}{(product.isBestSeller || product.bestSeller) && <span>Best seller</span>}{product.onSale && <span>Last chance</span>}</div><button className="shop-view-model" type="button" onClick={() => { if (gender === "women" && !isFeaturedEdit) { selectFitPiece(product); setFitModelSize(selectedSize || "M"); document.getElementById("fit-studio")?.scrollIntoView({ behavior: "smooth", block: "center" }); } else setTryOnProductId(product.id); }}>{gender === "women" && !isFeaturedEdit ? "View fit on model" : "Quick view"} </button></div>
                        <div className="shop-product-info"><div><p>{product.collection}</p><h2><Link to={`/products/${slugify(product.name)}`}>{product.name}</Link></h2><small>{product.category} · {product.activity}</small></div><strong>{formatMoney(price)}{product.onSale && product.salePrice && <del>{formatMoney(product.price)}</del>}</strong></div>
                        <div className="shop-card-fit"><div className="shop-card-fit-heading"><span>{isApparel ? "Select a size" : "Select a fit"}</span><span>{selectedSize ? `Model view · ${selectedSize}` : "Choose size"}</span></div><div className="shop-size-options" role="group" aria-label={`Choose ${product.name} size`}>{(isApparel ? apparelSizes : availableSizes).map((size) => <button key={size} type="button" className={selectedSize === size ? "selected" : ""} aria-pressed={selectedSize === size} disabled={!availableSizes.includes(size)} onClick={() => setProductSize(product, size)}>{size}</button>)}</div><button className="shop-add-size" type="button" onClick={() => addProductToBag(product)} disabled={!selectedSize || Number(product.stock) <= 0}>{Number(product.stock) <= 0 ? "Sold out" : `Add ${selectedSize || "size"} to bag`} </button></div>
                    </article>;
                })}
                    </div>
                    <button className="shop-gallery-arrow shop-gallery-arrow-next" type="button" onClick={() => scrollGallery(1)} disabled={!galleryCanNext} aria-label="Next product">›</button>
                    <div className="shop-gallery-position" aria-live="polite"><span>{String(Math.min(galleryIndex + 1, filteredProducts.length)).padStart(2, "0")}</span><i/><span>{String(filteredProducts.length).padStart(2, "0")}</span><small>DRAG OR SWIPE TO EXPLORE</small></div>
                </div> : <div className="shop-empty"><span>Nothing in this edit just yet.</span><p>Try clearing a filter to see all {pageTitle.toLowerCase()} pieces.</p><button type="button" onClick={clearFilters}>Clear filters</button></div>}
            </section>
        </div>}
        {tryOnProduct && <div className="fit-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setTryOnProductId(""); }}><section className="fit-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="fit-preview-title"><button className="fit-preview-close" type="button" onClick={() => setTryOnProductId("")} aria-label="Close fit preview">×</button><div className={`fit-preview-photo tone-${tryOnProduct.tone || "sand"}`}><img src={gender === "women" && fitWardrobeProducts.some((piece) => piece.id === tryOnProduct.id) ? getFitVariantSrc(tryOnProduct) : storeImageUrl(tryOnProduct.image, 1800)} alt={`${tryOnProduct.name}${gender === "men" ? " on model" : " product view"}`}/><span>{gender === "men" ? "MODEL FIT PREVIEW" : "PRODUCT VIEW"}</span></div><div className="fit-preview-details"><p className="shop-eyebrow">{gender === "men" ? "FIT PREVIEW" : "PRODUCT VIEW"}</p><h2 id="fit-preview-title">{tryOnProduct.name}</h2><p className="fit-preview-description">{gender === "men" ? "View this piece on model, then select an available size for your bag." : "Review the details, then choose an available size for your bag."}</p><div className="fit-preview-current">Selected size <strong>{getSelectedSize(tryOnProduct) || "Choose a size"}</strong></div><div className="fit-preview-sizes" role="group" aria-label={`Choose ${tryOnProduct.name} size`}>{(gender === "accessories" ? getProductSizes(tryOnProduct) : apparelSizes).map((size) => <button key={size} type="button" className={getSelectedSize(tryOnProduct) === size ? "selected" : ""} aria-pressed={getSelectedSize(tryOnProduct) === size} disabled={!getProductSizes(tryOnProduct).includes(size)} onClick={() => setProductSize(tryOnProduct, size)}>{size}</button>)}</div><p className="fit-preview-availability">{getProductSizes(tryOnProduct).length ? "Choose from available sizes. Disabled sizes are not currently stocked." : "One size"}</p><button className="shop-add-size fit-preview-add" type="button" onClick={() => { addProductToBag(tryOnProduct); setTryOnProductId(""); }} disabled={!getSelectedSize(tryOnProduct) || Number(tryOnProduct.stock) <= 0}>{Number(tryOnProduct.stock) <= 0 ? "Sold out" : `Add ${getSelectedSize(tryOnProduct) || "size"} to bag`} </button></div></section></div>}
        {fitZoomArea && gender === "women" && <div className="fit-preview-backdrop fit-zoom-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFitZoomArea(""); }}><section className="fit-zoom-dialog" role="dialog" aria-modal="true" aria-labelledby="fit-zoom-title"><button className="fit-preview-close" type="button" onClick={() => setFitZoomArea("")} aria-label="Close model zoom">×</button><div className={`fit-zoom-photo fit-zoom-${fitZoomArea}`} style={fitModelStyle}><div className="fit-model-layer fit-model-lower" style={getFitModelLayerStyle(fitLowerProduct)} aria-hidden="true"></div><div className={`fit-model-layer fit-model-upper ${fitUpperProduct?.id === "studio-rib-tank" ? "fit-model-upper-long" : ""}`} style={getFitModelLayerStyle(fitUpperProduct)} aria-hidden="true"></div><span>SIZE {fitModelSize} · {fitZoomArea === "top" ? "UPPER FIT" : "LOWER FIT"}</span></div><div className="fit-zoom-details"><p className="shop-eyebrow">FIT REFERENCE</p><h2 id="fit-zoom-title">Size {fitModelSize} model</h2><p>Zoomed view of the {fitZoomArea === "top" ? "upper-body" : "lower-body"} fit. Choose another model size or piece to compare.</p>{(fitZoomArea === "top" ? fitUpperProduct : fitLowerProduct) && <div className="fit-zoom-product"><small>WORN IN THIS FIT ZONE · {getFitColor(fitZoomArea === "top" ? fitUpperProduct : fitLowerProduct).name.toUpperCase()}</small><strong>{(fitZoomArea === "top" ? fitUpperProduct : fitLowerProduct).name}</strong><span>{(fitZoomArea === "top" ? fitUpperProduct : fitLowerProduct).category} · {formatMoney(effectivePrice(fitZoomArea === "top" ? fitUpperProduct : fitLowerProduct))}</span></div>}</div></section></div>}
        {isCollectionLanding ? <footer className="collection-landing-footer">
            <div className="landing-footer-main">
                <nav className="landing-footer-links" aria-label="Help and account">
                    <section><h2>Help</h2><Link to="/pages/faq">Frequently asked questions</Link><Link to="/orders/track">Track an order</Link><Link to="/pages/delivery">Delivery information</Link><Link to="/pages/returns">Returns and exchanges</Link><Link to="/pages/contact">Contact us</Link></section>
                    <section><h2>My Account</h2><Link to="/checkout">Shopping bag</Link><Link to="/account">Order details</Link><Link to="/pages/contact">Get in touch</Link></section>
                    <section><h2>Pages</h2><Link to="/collections/women">Women</Link><Link to="/collections/men">Men</Link><Link to="/collections/accessories">Accessories</Link><Link to="/explore">Explore Saltlyne</Link><Link to="/story">Our story</Link></section>
                </nav>
                <section className="landing-footer-about" aria-labelledby="landing-footer-about-title">
                    <h2 id="landing-footer-about-title">More about Saltlyne</h2>
                    <div className="landing-footer-cards">
                        <Link to="/story" className="landing-footer-card"><span className="landing-footer-card-mark"><img src={storeContent?.settings?.logoUrl || "/images/saltlyne-logo-black.png"} alt=""/></span><span><strong>Our story</strong><small>Discover movement by the coast</small></span></Link>
                        <Link to={`/collections/${gender}?sort=newest`} className="landing-footer-card"><span className="landing-footer-card-mark" aria-hidden="true">✳</span><span><strong>New arrivals</strong><small>Meet the latest Saltlyne edit</small></span></Link>
                        <Link to="/#newsletter" className="landing-footer-card"><span className="landing-footer-card-mark" aria-hidden="true">@</span><span><strong>Email sign up</strong><small>Get notes from the coast</small></span></Link>
                    </div>
                </section>
            </div>
            <div className="landing-footer-bottom">
                <PaymentMethodMarks className="footer-payment-icons footer-brand-payment-icons landing-footer-payment-brand" icons={storeContent?.paymentIcons}/>
                <span className="landing-footer-tagline">Clothes for wherever life takes you.</span>
                <small className="landing-footer-copyright">© 2026 Saltlyne Label</small>
            </div>
        </footer> : <footer className="shop-footer"><PaymentMethodMarks className="footer-payment-icons shop-footer-payment-brand" icons={storeContent?.paymentIcons}/><p>Coastal activewear, made in Sri Lanka.</p><Link to="/">Return to home</Link></footer>}
    </main>;
}
