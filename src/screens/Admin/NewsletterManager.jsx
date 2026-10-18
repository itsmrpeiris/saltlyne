import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

const initialBlocks = [
    { id: "campaign-heading", type: "heading", text: "A note from Saltlyne" },
    { id: "campaign-message", type: "paragraph", text: "" },
];

function imageAsWebp(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const scale = Math.min(1, 1400 / image.width, 1400 / image.height);
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);
            canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (!blob) return reject(new Error("Could not optimize this image."));
                if (blob.size > 300_000) return reject(new Error("Image is still larger than 300 KB after optimization. Please use a smaller image."));
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error("Could not read the optimized image."));
                reader.readAsDataURL(blob);
            }, "image/webp", 0.78);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Choose a valid image file."));
        };
        image.src = objectUrl;
    });
}

export default function NewsletterManager() {
    const [subscribers, setSubscribers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("subscribed");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState([]);
    const [subject, setSubject] = useState("");
    const [blocks, setBlocks] = useState(initialBlocks);
    const [design, setDesign] = useState({ pageColor: "#f4f5f1", cardColor: "#ffffff", textColor: "#414941", accentColor: "#303b39" });
    const [progress, setProgress] = useState(null);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    function setSubscriberRows(rows) {
        setSubscribers(rows);
        const active = new Set(rows.filter((row) => !row.unsubscribedAt).map((row) => row.email.toLowerCase()));
        setSelected((current) => current.filter((email) => active.has(email)));
    }
    async function loadSubscribers() {
        try {
            setSubscriberRows(await api("/admin/newsletter"));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        let mounted = true;
        api("/admin/newsletter").then((rows) => {
            if (mounted) setSubscriberRows(rows);
        }).catch((err) => {
            if (mounted) setError(err.message);
        }).finally(() => {
            if (mounted) setLoading(false);
        });
        return () => { mounted = false; };
    }, []);

    const activeCount = subscribers.filter((subscriber) => !subscriber.unsubscribedAt).length;
    const visibleSubscribers = useMemo(() => subscribers.filter((subscriber) => {
        const active = !subscriber.unsubscribedAt;
        const statusMatches = filter === "all" || (filter === "subscribed" && active) || (filter === "unsubscribed" && !active);
        const query = search.trim().toLowerCase();
        return statusMatches && (!query || `${subscriber.email} ${subscriber.name || ""}`.toLowerCase().includes(query));
    }), [filter, search, subscribers]);
    const visibleActiveEmails = visibleSubscribers.filter((subscriber) => !subscriber.unsubscribedAt).map((subscriber) => subscriber.email.toLowerCase());

    function toggleEmail(email) {
        const normalized = email.toLowerCase();
        setSelected((current) => current.includes(normalized) ? current.filter((value) => value !== normalized) : [...current, normalized]);
    }
    function toggleVisible() {
        const allSelected = visibleActiveEmails.length > 0 && visibleActiveEmails.every((email) => selected.includes(email));
        setSelected((current) => allSelected
            ? current.filter((email) => !visibleActiveEmails.includes(email))
            : [...new Set([...current, ...visibleActiveEmails])]);
    }
    function updateBlock(id, changes) {
        setBlocks((current) => current.map((block) => block.id === id ? { ...block, ...changes } : block));
    }
    function addBlock(type) {
        const block = type === "image" ? { type, image: "", alt: "" }
            : type === "button" ? { type, text: "Shop now", url: "https://saltlyne.com" }
                : type === "divider" ? { type }
                    : { type, text: type === "heading" ? "New section" : "" };
        setBlocks((current) => [...current, { id: crypto.randomUUID(), ...block }]);
    }
    function moveBlock(id, direction) {
        setBlocks((current) => {
            const index = current.findIndex((block) => block.id === id);
            const nextIndex = index + direction;
            if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
            const next = [...current];
            [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
            return next;
        });
    }
    async function uploadImage(id, file) {
        if (!file) return;
        setError("");
        try {
            const image = await imageAsWebp(file);
            updateBlock(id, { image });
        } catch (err) {
            setError(err.message);
        }
    }
    async function sendCampaign(event) {
        event.preventDefault();
        setError("");
        setNotice("");
        const selectedBlocks = blocks.filter((block) => block.type !== "image" || block.image);
        if (!selected.length) return setError("Select at least one subscribed recipient.");
        if (!selectedBlocks.some((block) => ["heading", "paragraph"].includes(block.type) && block.text.trim())) return setError("Add some text to your newsletter.");
        if (!window.confirm(`Send “${subject}” to ${selected.length} selected subscribed recipient${selected.length === 1 ? "" : "s"}?`)) return;
        setSending(true);
        let offset = 0;
        let sent = 0;
        let failed = 0;
        let total = selected.length;
        setProgress({ sent, failed, total });
        try {
            do {
                const result = await api("/admin/newsletter/campaign", {
                    method: "POST",
                    body: JSON.stringify({
                        subject,
                        selectedEmails: selected,
                        blocks: selectedBlocks.map(({ id: _id, ...block }) => block),
                        design,
                        offset,
                    }),
                });
                sent += result.sent;
                failed += result.failed;
                total = result.total;
                offset = result.nextOffset;
                setProgress({ sent, failed, total });
            } while (offset !== null);
            if (failed) setError(`Campaign finished: ${sent} sent and ${failed} failed. Check email delivery before retrying to avoid duplicates.`);
            else setNotice(`Newsletter sent to ${sent} of ${total} selected subscribed recipients.`);
            setSelected([]);
            await loadSubscribers();
        } catch (err) {
            setError(`Campaign stopped after ${sent} sent and ${failed} failed. ${err.message} Check delivery progress before retrying to avoid duplicate messages.`);
        } finally {
            setSending(false);
        }
    }

    return <div className="newsletter-manager">
        <section className="admin-panel">
            <div className="admin-panel-heading"><div><p className="admin-eyebrow">AUDIENCE</p><h2>{activeCount} subscribed <span className="newsletter-count-divider">/</span> {subscribers.length - activeCount} unsubscribed</h2><small className="admin-panel-hint">Only currently subscribed contacts can be selected or sent campaigns. Unsubscribe status is enforced again by the sending API.</small></div><button type="button" className="newsletter-action newsletter-action--quiet" onClick={() => { setError(""); loadSubscribers(); }}><span aria-hidden="true">↻</span> Refresh list</button></div>
            <div className="newsletter-audience-controls">
                <label>Subscription status<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All statuses</option><option value="subscribed">Subscribed</option><option value="unsubscribed">Unsubscribed</option></select></label>
                <label>Search subscribers<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or email"/></label>
                <button type="button" className="newsletter-action newsletter-action--primary" disabled={!visibleActiveEmails.length} onClick={toggleVisible}>{visibleActiveEmails.length && visibleActiveEmails.every((email) => selected.includes(email)) ? "Deselect visible" : "Select visible subscribed"}</button>
                <button type="button" className="newsletter-action newsletter-action--quiet" disabled={!selected.length} onClick={() => setSelected([])}>Clear selection</button>
                <span className="newsletter-selection-count"><strong>{selected.length}</strong>{" "}<span>selected</span></span>
            </div>
            <div className="admin-table-wrap"><table><thead><tr><th>Select</th><th>Email</th><th>Name</th><th>Joined</th><th>Status</th></tr></thead><tbody>
                {loading ? <tr><td colSpan="5" className="admin-empty-table">Loading subscribers…</td></tr>
                    : visibleSubscribers.length ? visibleSubscribers.map((subscriber) => {
                        const active = !subscriber.unsubscribedAt;
                        return <tr key={subscriber.email}>
                            <td><input type="checkbox" aria-label={`Select ${subscriber.email}`} disabled={!active} checked={active && selected.includes(subscriber.email.toLowerCase())} onChange={() => toggleEmail(subscriber.email)}/></td>
                            <td>{subscriber.email}</td><td>{subscriber.name || "—"}</td>
                            <td>{subscriber.createdAt ? new Date(subscriber.createdAt).toLocaleDateString() : "—"}</td>
                            <td><span className={`admin-status ${active ? "status-active" : "status-draft"}`}>{active ? "Subscribed" : "Unsubscribed"}</span></td>
                        </tr>;
                    }) : <tr><td colSpan="5" className="admin-empty-table">No subscribers match this filter.</td></tr>}
            </tbody></table></div>
        </section>

        <section className="admin-panel newsletter-composer">
            <div className="admin-panel-heading"><div><p className="admin-eyebrow">CAMPAIGN DESIGNER</p><h2>Compose newsletter</h2><small className="admin-panel-hint">Add and arrange text, images, dividers, and call-to-action buttons. Images are optimized and embedded in each email.</small></div></div>
            {error && <p className="admin-error admin-notice" role="alert">{error}</p>}{notice && <p className="admin-success admin-notice" role="status">{notice}</p>}
            <form onSubmit={sendCampaign}>
                <label className="newsletter-subject">Email subject<input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength="160" required/></label>
                <div className="newsletter-design-controls">
                    <label>Page background<input type="color" value={design.pageColor} onChange={(event) => setDesign((current) => ({ ...current, pageColor: event.target.value }))}/></label>
                    <label>Email panel<input type="color" value={design.cardColor} onChange={(event) => setDesign((current) => ({ ...current, cardColor: event.target.value }))}/></label>
                    <label>Text color<input type="color" value={design.textColor} onChange={(event) => setDesign((current) => ({ ...current, textColor: event.target.value }))}/></label>
                    <label>Button & link color<input type="color" value={design.accentColor} onChange={(event) => setDesign((current) => ({ ...current, accentColor: event.target.value }))}/></label>
                </div>
                <div className="newsletter-designer-layout">
                    <div className="newsletter-block-list">
                        {blocks.map((block, index) => <article className="newsletter-block-editor" key={block.id}>
                            <div className="newsletter-block-heading"><strong>{block.type === "paragraph" ? "Text" : block.type}</strong><div><button type="button" aria-label="Move block up" disabled={!index} onClick={() => moveBlock(block.id, -1)}>↑</button><button type="button" aria-label="Move block down" disabled={index === blocks.length - 1} onClick={() => moveBlock(block.id, 1)}>↓</button><button type="button" aria-label="Remove block" onClick={() => setBlocks((current) => current.filter((item) => item.id !== block.id))}>×</button></div></div>
                            {["heading", "paragraph"].includes(block.type) && <textarea aria-label={`${block.type} text`} rows={block.type === "heading" ? 2 : 5} maxLength={block.type === "heading" ? 160 : 4000} value={block.text} onChange={(event) => updateBlock(block.id, { text: event.target.value })} placeholder={block.type === "heading" ? "Section heading" : "Write your newsletter text…"}/>}
                            {block.type === "image" && <><input type="file" accept="image/*" aria-label="Upload newsletter image" onChange={(event) => uploadImage(block.id, event.target.files?.[0])}/><input value={block.alt} maxLength="180" aria-label="Image description" onChange={(event) => updateBlock(block.id, { alt: event.target.value })} placeholder="Image description for accessibility"/>{block.image && <img className="newsletter-upload-preview" src={block.image} alt={block.alt}/>}<small>Optimized WebP, up to 300 KB per image.</small></>}
                            {block.type === "button" && <><input value={block.text} maxLength="80" aria-label="Button label" onChange={(event) => updateBlock(block.id, { text: event.target.value })} placeholder="Button label"/><input type="url" value={block.url} aria-label="Button destination" onChange={(event) => updateBlock(block.id, { url: event.target.value })} placeholder="https://…"/></>}
                            {block.type === "divider" && <p className="newsletter-divider-hint">A fine divider will appear in the email.</p>}
                        </article>)}
                        <div className="newsletter-add-blocks"><button type="button" onClick={() => addBlock("heading")}>＋ Heading</button><button type="button" onClick={() => addBlock("paragraph")}>＋ Text</button><button type="button" onClick={() => addBlock("image")}>＋ Image</button><button type="button" onClick={() => addBlock("button")}>＋ Button</button><button type="button" onClick={() => addBlock("divider")}>＋ Divider</button></div>
                    </div>
                    <div className="newsletter-preview-frame" style={{ backgroundColor: design.pageColor }}><aside className="newsletter-preview" style={{ backgroundColor: design.cardColor, color: design.textColor }}><p className="admin-eyebrow">EMAIL PREVIEW</p><h3>{subject || "Your subject line"}</h3>{blocks.map((block) => {
                        if (block.type === "heading") return <h2 key={block.id} style={{ color: design.textColor }}>{block.text || "Section heading"}</h2>;
                        if (block.type === "paragraph") return <p key={block.id} style={{ color: design.textColor }}>{block.text || "Your newsletter text will appear here."}</p>;
                        if (block.type === "image") return block.image ? <img key={block.id} src={block.image} alt={block.alt}/> : <div className="newsletter-preview-image" key={block.id}>Image preview</div>;
                        if (block.type === "button") return <p key={block.id} className="newsletter-preview-button" style={{ backgroundColor: design.accentColor }}>{block.text || "Button"}</p>;
                        return <hr key={block.id}/>;
                    })}<small>Saltlyne Label · Unsubscribe link included</small></aside></div>
                </div>
                {progress && <p className="admin-panel-hint">Delivery progress: {progress.sent} sent, {progress.failed} failed, of {progress.total} selected active recipients.</p>}
                <div className="newsletter-send-row"><span>Sending to <strong>{selected.length}</strong> selected subscribed recipients</span><button className="newsletter-action newsletter-action--primary newsletter-action--send" disabled={sending || loading || !selected.length}>{sending ? `Sending… ${progress?.sent || 0}/${progress?.total || 0}` : <><span>Send newsletter</span><span aria-hidden="true">↗</span></>}</button></div>
            </form>
        </section>
    </div>;
}
