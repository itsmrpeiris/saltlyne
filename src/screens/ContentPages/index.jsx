import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { api } from "../../lib/api";
import { useStoreContent } from "../../lib/useStoreContent";
import "./style.css";

function ContentFrame({ eyebrow, title, logoUrl, children }) {
    return <main className="store-content-page">
        <header className="checkout-header"><Link className="checkout-wordmark" to="/"><img className="brand-logo-image" src={logoUrl || "/images/saltlyne-logo-black.png"} alt="Saltlyne"/><small>LABEL</small></Link><span>{eyebrow}</span><Link to="/" className="checkout-back">← Back to Saltlyne</Link></header>
        <article className="store-content-article"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children}</article>
        <footer className="checkout-footer">© 2026 Saltlyne Label <span>Made for wherever life takes you.</span></footer>
    </main>;
}

function SupportForm() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function submit(event) {
        event.preventDefault();
        const formElement = event.currentTarget;
        setBusy(true);
        setError("");
        setNotice("");
        const form = new FormData(event.currentTarget);
        try {
            const result = await api("/support", { method: "POST", body: JSON.stringify(Object.fromEntries(form.entries())) });
            if (!result.supportEmailSent) {
                setError("We couldn't deliver your message to customer care. Please email support@saltlyne.com directly.");
            } else {
                setNotice(result.customerReceiptSent
                    ? "Your message has reached customer care. A copy is on its way to your inbox."
                    : "Your message has reached customer care. We couldn't send the automatic receipt, but our team has your message.");
                formElement.reset();
            }
        } catch (reason) {
            setError(reason.message);
        } finally {
            setBusy(false);
        }
    }

    return <form className="support-contact-form" onSubmit={submit}>
        <label>Your name<input name="name" autoComplete="name" maxLength="120" required/></label>
        <label>Email address<input name="email" type="email" autoComplete="email" maxLength="254" required/></label>
        <label>Subject<input name="subject" maxLength="160" required/></label>
        <label>Message<textarea name="message" rows="5" minLength="10" maxLength="5000" required/></label>
        {error && <p className="contact-form-message is-error" role="alert">{error}</p>}
        {notice && <p className="contact-form-message" role="status">{notice}</p>}
        <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
    </form>;
}

export function HelpPage() {
    const { slug = "" } = useParams();
    const { content, error } = useStoreContent();
    const page = content?.pages?.find((entry) => entry.slug === slug);
    const logoUrl = content?.settings?.logoUrl;
    if (error) return <ContentFrame eyebrow="HELP" title="Page unavailable" logoUrl={logoUrl}><p role="alert">{error}</p></ContentFrame>;
    if (!content) return <ContentFrame eyebrow="HELP" title="Loading…" logoUrl={logoUrl}><p>Loading page content…</p></ContentFrame>;
    if (!page) return <ContentFrame eyebrow="HELP" title="Page unavailable" logoUrl={logoUrl}><p role="alert">This help page could not be found.</p></ContentFrame>;
    return <ContentFrame eyebrow={page.eyebrow || "HELP"} title={page.title} logoUrl={logoUrl}>
        <p className="store-content-intro">{page.intro}</p>
        {(page.sections || []).map((section) => <section className="store-content-section" key={section.heading}><h2>{section.heading}</h2><p>{slug === "contact" ? section.body.replaceAll("hello@saltlynelabel.com", "support@saltlyne.com") : section.body}</p></section>)}
        <p className="store-content-links">{slug === "contact" && <><a href="mailto:support@saltlyne.com">Email support@saltlyne.com</a> · </>}<Link to="/orders/track">Track an order</Link> · <Link to="/account">My account</Link></p>
        {slug === "contact" && <SupportForm/>}
    </ContentFrame>;
}

export function NewsletterUnsubscribe() {
    const [params] = useSearchParams();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    async function unsubscribe() {
        setBusy(true);
        setError("");
        try {
            await api("/newsletter/unsubscribe", { method: "POST", body: JSON.stringify({ token: params.get("token") }) });
            setDone(true);
        } catch (reason) {
            setError(reason.message);
        } finally {
            setBusy(false);
        }
    }

    return <ContentFrame eyebrow="EMAIL PREFERENCES" title={done ? "You’re unsubscribed." : "Unsubscribe from emails"}>
        {done ? <p>You won’t receive Saltlyne newsletter campaigns at this address. You can join again from the storefront whenever you like.</p> : <>
            <p>Confirm to stop receiving Saltlyne newsletter emails. This does not affect order or support messages.</p>
            {error && <p role="alert">{error}</p>}
            <button className="support-contact-submit" type="button" disabled={busy || !params.get("token")} onClick={unsubscribe}>{busy ? "Updating…" : "Unsubscribe"}</button>
        </>}
    </ContentFrame>;
}

export function StoryPage() {
    const { content, error } = useStoreContent();
    const story = content?.home?.story;
    return <ContentFrame eyebrow="OUR STORY" title="Find your way back." logoUrl={content?.settings?.logoUrl}>
        {error ? <p role="alert">{error}</p> : !story ? <p>Loading story…</p> : story.map((chapter) => <section className="store-content-section" key={chapter.title}><h2>{chapter.title}</h2>{chapter.blocks.map((block, index) => block.type === "quote" ? <blockquote key={index}>{block.text}</blockquote> : <p key={index}>{block.text}</p>)}</section>)}
    </ContentFrame>;
}
