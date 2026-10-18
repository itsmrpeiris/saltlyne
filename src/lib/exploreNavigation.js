let pendingExploreScrollY = null;

export function rememberExploreScroll(event) {
    if (event && (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    pendingExploreScrollY = window.scrollY;
}

export function restoreExploreScroll() {
    if (pendingExploreScrollY === null) return;
    window.scrollTo(0, pendingExploreScrollY);
    pendingExploreScrollY = null;
}
