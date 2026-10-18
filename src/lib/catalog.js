import { seedProducts } from "../../shared/catalog.js";

const legacySeedImages = {
    "sculpt-seamless-leggings": "photo-1506629905607-d9c297d64f96",
    "everyday-form-bra": "photo-1515886657613-9f3515b0c78f",
    "studio-rib-tank": "photo-1534528741775-53994a69daeb",
    "move-with-ease-short": "photo-1512316609839-ce289d3eba0a",
};
const retiredProductIds = new Set(["coastline-leggings"]);

export const fallbackCatalog = seedProducts.map((product) => ({
    ...product,
    isTrending: product.trendingMode === "on",
    isBestSeller: product.bestSeller,
}));

export function mergeCatalog(serverProducts = []) {
    const currentSchema = serverProducts.some((product) => product.gender && product.category);
    const requiredFitPieces = new Set(["everyday-form-bra", "studio-rib-tank", "move-with-ease-short", "sculpt-seamless-leggings", "elephant-trail-flare-leggings"]);
    const fallbackProducts = currentSchema
        ? fallbackCatalog.filter((product) => requiredFitPieces.has(product.id) && !serverProducts.some((serverProduct) => serverProduct.id === product.id))
        : fallbackCatalog.filter((product) => !Object.hasOwn(legacySeedImages, product.id) || requiredFitPieces.has(product.id));
    const merged = new Map(fallbackProducts.map((product) => [product.id, product]));
    for (const product of serverProducts) {
        if (retiredProductIds.has(product.id)) continue;
        const seeded = fallbackCatalog.find((item) => item.id === product.id) || merged.get(product.id) || {};
        const solidLegging = product.id === "elephant-trail-flare-leggings";
        const fitAsset = solidLegging || product.id === "sculpt-seamless-leggings";
        merged.set(product.id, {
            ...seeded,
            ...product,
            gender: product.gender || seeded.gender || "women",
            category: product.category || seeded.category || "tops",
            subcategory: solidLegging ? seeded.subcategory : product.subcategory || seeded.subcategory || "essentials",
            collection: product.collection || seeded.collection || "Everyday Essentials",
            activity: product.activity || seeded.activity || "everyday",
            sizes: Array.isArray(product.sizes) ? product.sizes : seeded.sizes || [],
            colors: Array.isArray(product.colors) ? product.colors : seeded.colors || [],
            description: solidLegging || product.id === "sculpt-seamless-leggings" ? seeded.description : product.description || seeded.description,
            image: fitAsset ? seeded.image : product.image === legacySeedImages[product.id] && seeded.image ? seeded.image : product.image || seeded.image,
        });
    }
    return [...merged.values()];
}
