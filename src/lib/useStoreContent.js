import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { normalizeStoreContentIcons } from "../../shared/iconLinks.js";

export function useStoreContent() {
    const [result, setResult] = useState({ content: null, error: "", loading: true });
    const requestId = useRef(0);
    const refresh = useCallback(async () => {
        const currentRequest = ++requestId.current;
        try {
            const content = normalizeStoreContentIcons(await api("/store-content", { cache: "no-store" }));
            if (currentRequest === requestId.current) setResult({ content, error: "", loading: false });
        } catch (error) {
            if (currentRequest === requestId.current) {
                setResult((current) => ({ ...current, error: error.message, loading: false }));
            }
        }
    }, []);
    useEffect(() => {
        void refresh();
        const update = () => { void refresh(); };
        const onStorage = (event) => {
            if (event.key === "saltlyne-store-content-updated") update();
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") update();
        };
        window.addEventListener("saltlyne:store-content-updated", update);
        window.addEventListener("storage", onStorage);
        window.addEventListener("focus", update);
        window.addEventListener("pageshow", update);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            requestId.current += 1;
            window.removeEventListener("saltlyne:store-content-updated", update);
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("focus", update);
            window.removeEventListener("pageshow", update);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, [refresh]);
    return result;
}
