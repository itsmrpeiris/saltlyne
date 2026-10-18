import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faApplePay,
    faCcAmex,
    faCcMastercard,
    faCcVisa,
    faFacebookF,
    faInstagram,
    faPaypal,
    faPinterestP,
    faThreads,
    faTwitter,
    faXTwitter,
} from "@fortawesome/free-brands-svg-icons";
import { migrateIconCollection, paymentIconDefinitions, safeExternalUrl, socialIconDefinitions } from "../../shared/iconLinks.js";

const iconDefinitions = {
    facebook: faFacebookF,
    pinterest: faPinterestP,
    instagram: faInstagram,
    twitter: faTwitter,
    x: faXTwitter,
    threads: faThreads,
    visa: faCcVisa,
    mastercard: faCcMastercard,
    amex: faCcAmex,
    paypal: faPaypal,
    applePay: faApplePay,
};

export function IconArtwork({ icon, kind }) {
    if (icon.image) return <img className={`footer-icon-art is-${kind}`} src={icon.image} alt="" aria-hidden="true"/>;
    const definition = iconDefinitions[icon.key];
    if (!definition) return <span className="footer-icon-fallback" aria-hidden="true">{icon.name.slice(0, 1).toUpperCase()}</span>;
    return <FontAwesomeIcon icon={definition} aria-hidden="true"/>;
}

export default function IconMarks({ icons, kind, className }) {
    const definitions = kind === "social" ? socialIconDefinitions : paymentIconDefinitions;
    const normalizedIcons = migrateIconCollection(icons, definitions, kind);
    return <div className={className} aria-label={kind === "social" ? "Social media" : "Payment methods"}>
        {normalizedIcons.filter((icon) => icon.enabled !== false)
            .slice()
            .sort((left, right) => left.order - right.order)
            .map((icon) => {
                const href = safeExternalUrl(icon.url);
                const mark = <span
                    className={`footer-icon-tile footer-${kind}-icon${icon.image ? " has-custom-art" : ""}`}
                    data-icon-key={icon.key || "custom"}
                    role={href ? undefined : "img"}
                    aria-label={href ? undefined : icon.name}
                >
                    <IconArtwork icon={icon} kind={kind}/>
                </span>;
                return href
                    ? <a key={icon.id} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${kind === "social" ? "Saltlyne on" : ""} ${icon.name}${kind === "payment" ? " payment information" : ""}`}>{mark}</a>
                    : <span key={icon.id}>{mark}</span>;
            })}
    </div>;
}
