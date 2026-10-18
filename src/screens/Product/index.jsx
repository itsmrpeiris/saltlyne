import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useCart } from "../../context/CartContext";
import { api } from "../../lib/api";
import { storeImageUrl } from "../../lib/images";
import { useStoreContent } from "../../lib/useStoreContent";
import "./style.css";

export default function Product() {
    const { slug } = useParams();
    const { content: storeContent } = useStoreContent();
    const { addItem, count, formatMoney } = useCart();
    const [result, setResult] = useState(null);
    const [size, setSize] = useState("");
    const [activeImage, setActiveImage] = useState(0);
    const [notice, setNotice] = useState("");
    const product = result?.slug === slug ? result.product : null;
    const error = result?.slug === slug ? result.error : "";

    useEffect(() => {
        api(`/products/${encodeURIComponent(slug)}`).then((item) => {
            setResult({ slug, product: item, error: "" });
            setSize(item.sizes?.[0] || "");
            setActiveImage(0);
        }).catch((reason) => setResult({ slug, product: null, error: reason.message }));
    }, [slug]);

    function addToBag() {
        if (product.sizes?.length && !size) {
            setError("Choose a size before adding this item.");
            return;
        }
        setError("");
        setNotice(`${product.name} was added to your bag.`);
        const priceValue = product.onSale && Number(product.salePrice) > 0 && Number(product.salePrice) < Number(product.price) ? Number(product.salePrice) : Number(product.price);
        addItem({ ...product, size, priceValue, price: formatMoney(priceValue) });
    }
    const productImages = product?.images?.length ? product.images : product ? [product.image] : [];

    return <main className="product-detail-page">
        <header className="checkout-header"><Link className="checkout-wordmark" to="/"><img className="brand-logo-image" src={storeContent?.settings?.logoUrl || "/images/saltlyne-logo-black.png"} alt="Saltlyne"/><small>LABEL</small></Link><span>THE COLLECTION</span><Link to="/checkout" className="checkout-back">Bag ({count})</Link></header>
        {error && !product ? <p className="product-load-error" role="alert">{error}</p> : product ? <section className="product-detail">
            <div className="product-detail-image"><img src={storeImageUrl(productImages[activeImage], 1800)} alt={product.name}/>{productImages.length > 1 && <div className="product-image-thumbnails" role="group" aria-label={`${product.name} images`}>{productImages.map((image, index) => <button className={activeImage === index ? "selected" : ""} type="button" key={`${image}-${index}`} onClick={() => setActiveImage(index)} aria-label={`View product image ${index + 1}`} aria-pressed={activeImage === index}><img src={storeImageUrl(image, 180)} alt=""/></button>)}</div>}</div>
            <div className="product-detail-copy">
                <p className="eyebrow">{product.tag || product.collection}</p><h1>{product.name}</h1>
                <p className="product-detail-price">{formatMoney(product.onSale && Number(product.salePrice) > 0 && Number(product.salePrice) < Number(product.price) ? product.salePrice : product.price)}</p>
                {product.description && <p>{product.description}</p>}
                {Array.isArray(product.sizes) && product.sizes.length > 0 && <label className="product-size-label">Size<select value={size} onChange={(event) => setSize(event.target.value)}><option value="">Choose a size</option>{product.sizes.map((item) => <option key={item}>{item}</option>)}</select></label>}
                {error && <p className="checkout-error" role="alert">{error}</p>}
                {notice && <p className="product-added-notice" role="status">{notice}</p>}
                <button className="checkout-primary" type="button" onClick={addToBag} disabled={product.stock <= 0}>{product.stock <= 0 ? "Sold out" : "Add to bag"}</button>
                <p className="product-detail-stock">{product.stock > 0 ? `${product.stock} available` : "Currently unavailable"}</p>
                <Link to={`/collections/${product.gender || "women"}`} className="product-back-link">← Continue exploring</Link>
            </div>
        </section> : !error && <p className="product-loading">Loading product…</p>}
        <footer className="checkout-footer">© 2026 Saltlyne Label <span>Made for wherever life takes you.</span></footer>
    </main>;
}
