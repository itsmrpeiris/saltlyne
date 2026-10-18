import { useEffect, useRef, useState } from "react";
import { IconArtwork } from "../../components/IconMarks";
import { migrateIconCollection, paymentIconDefinitions, safeExternalUrl, socialIconDefinitions } from "../../../shared/iconLinks.js";
import "./StoreContentEditor.css";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_CROPPED_DATA_URL_LENGTH = 80_000;

function normalizeOrder(icons) {
    return icons
        .map((icon, index) => ({ icon, index }))
        .sort((left, right) => Number(left.icon.order) - Number(right.icon.order) || left.index - right.index)
        .map(({ icon }, index) => ({ ...icon, order: index + 1 }));
}

function IconCropper({ kind, value, onChange }) {
    const canvasRef = useRef(null);
    const [source, setSource] = useState(null);
    const [error, setError] = useState("");
    const [zoom, setZoom] = useState(1);
    const [positionX, setPositionX] = useState(50);
    const [positionY, setPositionY] = useState(50);
    const width = kind === "social" ? 256 : 384;
    const height = kind === "social" ? 256 : 128;

    useEffect(() => {
        if (!source) return undefined;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) return undefined;
        const scale = Math.max(width / source.width, height / source.height) * zoom;
        const drawWidth = source.width * scale;
        const drawHeight = source.height * scale;
        const offsetX = -(drawWidth - width) * (positionX / 100);
        const offsetY = -(drawHeight - height) * (positionY / 100);
        context.clearRect(0, 0, width, height);
        context.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);
        return undefined;
    }, [source, zoom, positionX, positionY, width, height]);

    useEffect(() => () => source?.close(), [source]);

    async function uploadImage(file) {
        setError("");
        if (!file) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
            setError("Choose a PNG, JPEG or WebP image.");
            return;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            setError("The source image must be 10 MB or smaller.");
            return;
        }
        try {
            const bitmap = await createImageBitmap(file);
            if (bitmap.width > 8192 || bitmap.height > 8192) {
                bitmap.close();
                setError("The image dimensions must be 8192 pixels or smaller.");
                return;
            }
            setSource(bitmap);
            setZoom(1);
            setPositionX(50);
            setPositionY(50);
        } catch {
            setError("This image could not be opened. Try another PNG, JPEG or WebP file.");
        }
    }

    function saveCrop() {
        const canvas = canvasRef.current;
        if (!canvas) {
            setError("Wait for the crop preview to load, then try again.");
            return;
        }
        let croppedImage = "";
        for (const quality of [0.86, 0.74, 0.62, 0.5]) {
            croppedImage = canvas.toDataURL("image/webp", quality);
            if (croppedImage.length <= MAX_CROPPED_DATA_URL_LENGTH) break;
        }
        if (!croppedImage.startsWith("data:image/webp,") && !croppedImage.startsWith("data:image/webp;base64,")) {
            setError("Your browser could not create a WebP crop. Try another browser.");
            return;
        }
        if (croppedImage.length > MAX_CROPPED_DATA_URL_LENGTH) {
            setError("This crop is larger than 80 KB. Reduce image detail or try another image.");
            return;
        }
        onChange(croppedImage);
        setError("");
    }

    return <div className="cms-icon-cropper">
        <label className="cms-control">
            <span>Upload icon image</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadImage(event.target.files?.[0])}/>
            <small>PNG, JPEG or WebP · up to 10 MB. Crop is saved as an optimized WebP image.</small>
        </label>
        {source && <>
            <div className="cms-crop-preview">
                <canvas ref={canvasRef} width={width} height={height} style={{ aspectRatio: `${width}/${height}` }} aria-label={`${kind === "social" ? "Square" : "Wide"} crop preview`}/>
                <small>{kind === "social" ? "Square social icon" : "Wide payment mark"} · move the crop sliders to frame it</small>
            </div>
            <label className="cms-crop-range">Zoom <input aria-label="Crop zoom" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}/></label>
            <label className="cms-crop-range">Horizontal crop <input aria-label="Horizontal crop" type="range" min="0" max="100" value={positionX} onChange={(event) => setPositionX(Number(event.target.value))}/></label>
            <label className="cms-crop-range">Vertical crop <input aria-label="Vertical crop" type="range" min="0" max="100" value={positionY} onChange={(event) => setPositionY(Number(event.target.value))}/></label>
            <button type="button" className="cms-item-actions-button" onClick={saveCrop}>Use this crop</button>
        </>}
        {value && <div className="cms-icon-current"><span>Current icon</span><img src={value} alt="Current cropped icon"/></div>}
        {error && <p className="admin-error" role="alert">{error}</p>}
    </div>;
}

export default function IconLinksEditor({ icons, kind, onChange }) {
    const [editingId, setEditingId] = useState("");
    const [form, setForm] = useState(null);
    const [formError, setFormError] = useState("");
    const collectionName = kind === "social" ? "social icon" : "payment icon";
    const destinationLabel = kind === "social" ? "Social profile URL (HTTPS)" : "Payment information URL (HTTPS)";
    const definitions = kind === "social" ? socialIconDefinitions : paymentIconDefinitions;
    const normalizedIcons = migrateIconCollection(icons, definitions, kind);
    const sortedIcons = normalizedIcons.slice().sort((left, right) => left.order - right.order);

    function beginCreate() {
        if (normalizedIcons.length >= 16) return;
        setEditingId("");
        setFormError("");
        setForm({
            id: crypto.randomUUID(),
            name: "",
            enabled: true,
            url: "",
            order: 1,
            image: "",
        });
    }

    function beginEdit(icon) {
        setEditingId(icon.id);
        setFormError("");
        setForm({ ...icon });
    }

    function saveIcon(event) {
        event.preventDefault();
        const name = form.name.trim();
        const url = form.url.trim();
        if (!name) {
            setFormError("Enter an icon name.");
            return;
        }
        if (url && !safeExternalUrl(url)) {
            setFormError("Enter a valid HTTPS destination, or leave the URL blank.");
            return;
        }
        if (!editingId && !url) {
            setFormError("Add the HTTPS destination for this new icon.");
            return;
        }
        if (!editingId && !form.image) {
            setFormError("Upload and crop artwork before adding this icon.");
            return;
        }
        const next = editingId
            ? normalizedIcons.map((icon) => icon.id === editingId ? { ...form, name, url } : icon)
            : [...normalizedIcons, { ...form, name, url, key: undefined }];
        onChange(normalizeOrder(next));
        setEditingId("");
        setForm(null);
        setFormError("");
    }

    function deleteIcon(icon) {
        if (!window.confirm(`Delete the ${icon.name} ${collectionName}?`)) return;
        onChange(normalizeOrder(normalizedIcons.filter((entry) => entry.id !== icon.id)));
        if (editingId === icon.id) {
            setEditingId("");
            setForm(null);
        }
    }

    function setOrder(icon, order) {
        onChange(normalizeOrder(normalizedIcons.map((entry) => entry.id === icon.id ? { ...entry, order: Number(order) || 1 } : entry)));
    }

    return <section className="cms-icon-manager" aria-label={`${kind === "social" ? "Social" : "Payment"} icon manager`}>
        <div className="cms-icon-manager-heading">
            <div><h2>{kind === "social" ? "Social icons" : "Payment icons"}</h2><p>Order 1 is the rightmost icon. Uploads are cropped to consistent {kind === "social" ? "square" : "wide"} proportions.</p><p className="cms-icon-publish-hint">After editing, choose <strong>Save and publish</strong> below to apply changes to the storefront.</p></div>
            <button type="button" className="admin-primary" onClick={beginCreate} disabled={normalizedIcons.length >= 16}>Create {collectionName}</button>
        </div>
        {form && <form className="cms-icon-form" onSubmit={saveIcon}>
            <h3>{editingId ? `Edit ${form.name}` : `Create ${collectionName}`}</h3>
            <label className="cms-control"><span>Name</span><input value={form.name} maxLength="80" onChange={(event) => setForm({ ...form, name: event.target.value })} required/></label>
            <label className="cms-control"><span>{destinationLabel}</span><input type="url" value={form.url} placeholder="https://…" onChange={(event) => setForm({ ...form, url: event.target.value })}/></label>
            <label className="cms-control"><span>Order (1 = rightmost)</span><input type="number" min="1" max={normalizedIcons.length + (editingId ? 0 : 1)} value={form.order} onChange={(event) => setForm({ ...form, order: Number(event.target.value) })} required/></label>
            <label className="cms-toggle"><input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })}/><span>Show on storefront</span></label>
            <IconCropper key={editingId || "new-icon"} kind={kind} value={form.image} onChange={(image) => setForm((current) => ({ ...current, image }))}/>
            {formError && <p className="admin-error" role="alert">{formError}</p>}
            <div className="admin-form-actions"><button type="button" className="admin-secondary" onClick={() => { setForm(null); setEditingId(""); }}>Cancel</button><button className="admin-primary">{editingId ? "Save icon" : "Add icon"}</button></div>
        </form>}
        <div className="cms-icon-list">
            {sortedIcons.map((icon) => <article className="cms-icon-card" key={icon.id}>
                <span className={`footer-icon-tile footer-${kind}-icon${icon.image ? " has-custom-art" : ""}`} data-icon-key={icon.key || "custom"}><IconArtwork icon={icon} kind={kind}/></span>
                <div className="cms-icon-details"><strong>{icon.name}</strong><span>Order {icon.order}{icon.enabled ? " · Visible" : " · Hidden"}</span><small>{icon.url || "No destination URL"}</small></div>
                <label className="cms-icon-order">Order<input type="number" min="1" max={normalizedIcons.length} value={icon.order} aria-label={`${icon.name} order`} onChange={(event) => setOrder(icon, event.target.value)}/></label>
                <div className="cms-icon-actions"><button type="button" onClick={() => beginEdit(icon)}>Edit</button><button type="button" className="is-remove" onClick={() => deleteIcon(icon)}>Delete</button></div>
            </article>)}
            {!sortedIcons.length && <p className="cms-icon-empty">No {kind} icons yet. Create one to add it to the storefront.</p>}
        </div>
    </section>;
}
