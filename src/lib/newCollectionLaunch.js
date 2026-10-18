const launchDeadlineKey = "saltlyne-new-collection-deadline-v1";
const launchDuration = 30 * 24 * 60 * 60 * 1000;

export function getNewCollectionLaunchDeadline() {
    if (typeof window === "undefined") return Date.now() + launchDuration;

    const storedDeadline = Number(window.localStorage.getItem(launchDeadlineKey));
    if (Number.isFinite(storedDeadline) && storedDeadline > 0) return storedDeadline;

    const deadline = Date.now() + launchDuration;
    window.localStorage.setItem(launchDeadlineKey, String(deadline));
    return deadline;
}

export function getNewCollectionCountdown(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    return {
        days: Math.floor(totalSeconds / 86400),
        hours: Math.floor((totalSeconds % 86400) / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
    };
}

export function formatNewCollectionCountdownValue(value) {
    return String(value).padStart(2, "0");
}
