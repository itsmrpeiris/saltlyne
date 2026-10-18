const apiBase = (import.meta.env.VITE_API_BASE_URL || window.SALTLYNE_API_BASE_URL || "").replace(/\/$/, "");

export async function api(path, options = {}) {
    const response = await fetch(`${apiBase}/api${path}`, { credentials: "include", headers: { "content-type": "application/json", ...options.headers }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
    return payload;
}
