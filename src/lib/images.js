const campaignImages = {
    "photo-1500530855697-b586d89ba3ee": "/images/coastal-runner-hero.jpg",
    "photo-1539109136881-3be0616acf4b": "/images/women-solo-galle-run.jpg",
    "photo-1524504388940-b1c1722653e1": "/images/women-solo-pink-studio.jpg",
    "photo-1506629905607-d9c297d64f96": "/images/women-training.jpg",
    "photo-1515886657613-9f3515b0c78f": "/images/women-coastal-studio.jpg",
    "photo-1534528741775-53994a69daeb": "/images/women-solo-teal-coast.jpg",
    "photo-1512316609839-ce289d3eba0a": "/images/men-training.jpg",
    "photo-1518611012118-696072aa579a": "/images/men-solo-kettlebell.jpg",
    "photo-1518310383802-640c2de311b2": "/images/women-coastal-studio.jpg",
    "photo-1517836357463-d25dfeac3438": "/images/men-training.jpg",
    "photo-1534438327276-14e5300c3a48": "/images/coastal-training-accessories.jpg",
    "photo-1583454110551-21f2fa2afe61": "/images/men-galle-run.jpg",
};

export function storeImageUrl(source, width = 900) {
    if (!source) return "";
    if (/^(https?:|data:|blob:)/i.test(source) || source.startsWith("/")) return source;
    if (campaignImages[source]) return campaignImages[source];
    return `https://images.unsplash.com/${source}?auto=format&fit=crop&w=${width}&q=85`;
}
