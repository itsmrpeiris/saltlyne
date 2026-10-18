import "./StoreContentEditor.css";
import IconLinksEditor from "./IconLinksEditor";

const sections = [
    ["settings", "Brand & announcements"],
    ["payments", "Payments"],
    ["settings.social", "Social icons"],
    ["paymentIcons", "Payment icons"],
    ["categories", "Collections"],
    ["home", "Homepage"],
    ["explore", "Explore"],
    ["pages", "Content pages"],
];

function labelFor(value) {
    if (value === "amex") return "American Express";
    return String(value)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/^./, (character) => character.toUpperCase());
}

function emptyValue(template) {
    if (Array.isArray(template)) return [];
    if (template && typeof template === "object") {
        return Object.fromEntries(Object.entries(template).map(([key, value]) => [key, emptyValue(value)]));
    }
    if (typeof template === "boolean") return false;
    if (typeof template === "number") return 0;
    return "";
}

function isLongText(key, value) {
    return typeof value === "string" && (
        value.length > 110 ||
        /body|description|intro|text|headline|quote|closing|alt|accountdetails|instructions/i.test(key)
    );
}

function ContentField({ name, value, template, onChange, depth = 0 }) {
    if (Array.isArray(value)) {
        const isObjectList = value.some((item) => item && typeof item === "object" && !Array.isArray(item)) ||
            template?.some((item) => item && typeof item === "object" && !Array.isArray(item));
        return <fieldset className={`cms-fieldset${depth ? " is-nested" : ""}`}>
            <legend>{labelFor(name)}</legend>
            {isObjectList ? <div className="cms-list">
                {value.map((item, index) => <details className="cms-item" key={`${name}-${index}`} open={depth === 0}>
                    <summary>{item?.title || item?.slug || item?.name || item?.label || `${labelFor(name).replace(/s$/, "")} ${index + 1}`}</summary>
                    <div className="cms-item-fields">
                        <ContentField
                            name={`${labelFor(name).replace(/s$/, "")} ${index + 1}`}
                            value={item}
                            template={template?.[index] ?? template?.[0] ?? value[0]}
                            onChange={(next) => onChange(value.map((entry, itemIndex) => itemIndex === index ? next : entry))}
                            depth={depth + 1}
                        />
                        <div className="cms-item-actions">
                            <button type="button" disabled={index === 0} onClick={() => onChange(value.map((entry, itemIndex) => itemIndex === index ? value[index - 1] : itemIndex === index - 1 ? value[index] : entry))}>Move up</button>
                            <button type="button" disabled={index === value.length - 1} onClick={() => onChange(value.map((entry, itemIndex) => itemIndex === index ? value[index + 1] : itemIndex === index + 1 ? value[index] : entry))}>Move down</button>
                            <button type="button" className="is-remove" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                        </div>
                    </div>
                </details>)}
            </div> : <div className="cms-list cms-list-strings">
                {value.map((item, index) => <div className="cms-string-item" key={`${name}-${index}`}>
                    <label>{labelFor(name)} {index + 1}
                        <textarea rows={isLongText(name, item) ? 3 : 1} value={item ?? ""} onChange={(event) => onChange(value.map((entry, itemIndex) => itemIndex === index ? event.target.value : entry))}/>
                    </label>
                    <button type="button" className="is-remove" aria-label={`Remove ${labelFor(name)} ${index + 1}`} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                </div>)}
            </div>}
            <button type="button" className="cms-add-button" onClick={() => onChange([
                ...value,
                isObjectList ? emptyValue(template?.[0] ?? template?.[template.length - 1] ?? value[0] ?? {}) : "",
            ])}>＋ Add {labelFor(name).replace(/s$/, "").toLowerCase()}</button>
        </fieldset>;
    }

    if (value && typeof value === "object") {
        return <fieldset className={`cms-fieldset${depth ? " is-nested" : ""}`}>
            <legend>{labelFor(name)}</legend>
            <div className="cms-object-fields">
                {Object.entries(value).map(([key, child]) => <ContentField
                    key={key}
                    name={key}
                    value={child}
                    template={template?.[key]}
                    onChange={(next) => onChange({ ...value, [key]: next })}
                    depth={depth + 1}
                />)}
            </div>
        </fieldset>;
    }

    if (typeof value === "boolean") {
        return <label className="cms-toggle">
            <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)}/>
            <span>{labelFor(name)}</span>
        </label>;
    }

    const inputType = typeof value === "number" ? "number" : /url|link/i.test(name) ? "url" : "text";
    const isTextarea = isLongText(name, value);
    const Input = isTextarea ? "textarea" : "input";
    const previewable = typeof value === "string" && /(?:image|poster|logo)url$/i.test(name) && value;
    return <label className="cms-control">
        <span>{labelFor(name)}</span>
        <Input
            type={Input === "input" ? inputType : undefined}
            rows={isTextarea ? 3 : undefined}
            step={inputType === "number" ? "any" : undefined}
            value={value ?? ""}
            onChange={(event) => onChange(typeof value === "number" ? Number(event.target.value) : event.target.value)}
        />
        {previewable && <span className="cms-media-preview">
            <img src={value} alt="" onError={(event) => { event.currentTarget.hidden = true; }}/>
            <small>Media preview · enter an image path or URL above</small>
        </span>}
    </label>;
}

export default function StoreContentEditor({ value, template, onChange, activeSection, onSectionChange }) {
    if (!value) return <div className="cms-loading">Loading editable storefront content…</div>;
    return <div className="cms-editor">
        <div className="cms-tabs" role="tablist" aria-label="Store content sections">
            {sections.map(([key, title]) => <button
                type="button"
                role="tab"
                aria-selected={activeSection === key}
                className={activeSection === key ? "is-active" : ""}
                key={key}
                onClick={() => onSectionChange(key)}
            >{title}</button>)}
        </div>
        {activeSection === "payments" && <aside className="cms-payment-notice">
            The selected payment instructions are shown to customers at checkout. Only enable Wise transfer after entering the receiving account details. This is a manual transfer flow; it does not process cards or verify transfers automatically.
        </aside>}
        {activeSection === "paymentIcons" && <aside className="cms-payment-notice">
            Each payment mark can be shown or hidden and linked to an HTTPS page. These are display links only; they do not connect a payment processor or enable card payments at checkout.
        </aside>}
        <div className="cms-section" role="tabpanel">
            {activeSection === "settings.social"
                ? <IconLinksEditor
                    kind="social"
                    icons={value.settings.social}
                    onChange={(social) => onChange({ ...value, settings: { ...value.settings, social } })}
                />
                : activeSection === "paymentIcons"
                    ? <IconLinksEditor
                        kind="payment"
                        icons={value.paymentIcons}
                        onChange={(paymentIcons) => onChange({ ...value, paymentIcons })}
                    />
                    : <ContentField
                        name={activeSection}
                        value={value[activeSection]}
                        template={template?.[activeSection]}
                        onChange={(next) => onChange({ ...value, [activeSection]: next })}
                    />}
        </div>
    </div>;
}
