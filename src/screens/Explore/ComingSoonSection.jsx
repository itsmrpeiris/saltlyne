import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { storeImageUrl } from "../../lib/images";
import { formatNewCollectionCountdownValue, getNewCollectionCountdown, getNewCollectionLaunchDeadline } from "../../lib/newCollectionLaunch";

export default function ComingSoonSection({ content }) {
    const [defaultDeadline] = useState(getNewCollectionLaunchDeadline);
    const [now, setNow] = useState(() => Date.now());
    const [motionAllowed, setMotionAllowed] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [playbackError, setPlaybackError] = useState(false);
    const heroVideo = useRef(null);
    const videoUrl = content?.videoUrl || "/new-collection-campaign.mp4";
    const posterUrl = content?.posterUrl || "/images/new-collection-campaign-poster.jpg";
    const teaserImageUrl = content?.teaserImageUrl || "/images/men-galle-run.jpg";
    const configuredDeadline = content?.launchAt ? Date.parse(content.launchAt) : defaultDeadline;
    const launchTimeError = !Number.isFinite(configuredDeadline);
    const deadline = launchTimeError ? defaultDeadline : configuredDeadline;
    const remainingMilliseconds = Math.max(0, deadline - now);
    const countdown = getNewCollectionCountdown(remainingMilliseconds);
    const hasLaunched = remainingMilliseconds === 0;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const launchDate = new Intl.DateTimeFormat(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
    }).format(deadline);
    const countdownItems = [
        ["Days", countdown.days],
        ["Hours", countdown.hours],
        ["Minutes", countdown.minutes],
        ["Seconds", countdown.seconds],
    ];

    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const updateMotionPreference = () => {
            const allowed = !reducedMotion.matches;
            setMotionAllowed(allowed);
            if (!allowed) setIsPlaying(false);
        };
        updateMotionPreference();
        reducedMotion.addEventListener("change", updateMotionPreference);
        return () => reducedMotion.removeEventListener("change", updateMotionPreference);
    }, []);

    useEffect(() => {
        const video = heroVideo.current;
        if (!video) return;

        if (isPlaying) {
            video.play().catch(() => {
                setIsPlaying(false);
                setPlaybackError(true);
            });
        } else {
            video.pause();
        }
    }, [isPlaying]);

    return <section className="coming-soon-section" id="new-collection" aria-label="The next Saltlyne collection">
        <section className="new-collection-hero" aria-label="New collection campaign">
            <video ref={heroVideo} className="new-collection-hero-video" autoPlay={motionAllowed} muted={isMuted} loop playsInline preload="metadata" poster={posterUrl} aria-label="Saltlyne new collection campaign video" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onError={() => { setIsPlaying(false); setPlaybackError(true); }}>
                <source src={videoUrl} type="video/mp4"/>
            </video>
            <div className="new-collection-hero-shade"/>
            <p className="new-collection-hero-kicker">SALTLYNE LABEL · SRI LANKA</p>
            <span className="new-collection-hero-mark" aria-hidden="true">A NEW CURRENT IS COMING</span>
            <div className="new-collection-video-controls" aria-label="Video controls">
                <button className="video-control-sound" type="button" onClick={() => setIsMuted((muted) => !muted)} aria-label={isMuted ? "Turn campaign sound on" : "Turn campaign sound off"} aria-pressed={!isMuted}>
                    {isMuted
                        ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4zM17 9l5 6M22 9l-5 6"/></svg>
                        : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6l-5 4H4zM16 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/></svg>}
                </button>
                <button className="video-control-playback" type="button" onClick={() => { setPlaybackError(false); setIsPlaying((playing) => !playing); }} aria-label={isPlaying ? "Pause campaign video" : "Play campaign video"} aria-pressed={isPlaying}>
                    {isPlaying
                        ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>
                        : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 12 7-12 7z"/></svg>}
                </button>
            </div>
            {playbackError && <p className="new-collection-video-error" role="status">The campaign video could not be played.</p>}
        </section>

        <section className="new-collection-countdown" aria-labelledby="countdown-title">
            <p className="new-collection-kicker">THE NEXT CHAPTER BEGINS IN</p>
            <h2 id="countdown-title">The wait is <em>almost over.</em></h2>
            {launchTimeError && <p role="alert">The configured launch time is invalid.</p>}
            {hasLaunched
                ? <p className="new-collection-countdown-ended">The new collection is ready to reveal.</p>
                : <div className="new-collection-countdown-clock" role="timer" aria-label={`${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes and ${countdown.seconds} seconds until the collection reveal`}>
                    {countdownItems.map(([label, value]) => <div className="new-collection-countdown-unit" key={label}>
                        <span>{formatNewCollectionCountdownValue(value)}</span>
                        <small>{label}</small>
                    </div>)}
                </div>}
            <p className="new-collection-launch-time">Your local time · {timezone} · {launchDate}</p>
        </section>

        <section className="new-collection-teaser" aria-label="The new collection is coming soon">
            <img src={storeImageUrl(teaserImageUrl, 1800)} alt="" loading="lazy"/>
            <div className="new-collection-teaser-shade"/>
            <div className="new-collection-teaser-copy">
                <span className="new-collection-teaser-eye" aria-hidden="true">◉</span>
                <p>REVEALING SOON</p>
                <h2><span>SOON</span><b>COMING</b></h2>
                <Link to="/#newsletter">Stay tuned</Link>
            </div>
        </section>

        {hasLaunched && <section className="new-collection-reveal" aria-label="New collection preview">
            <p className="new-collection-kicker">THE WAIT IS OVER</p>
            <h2>A new collection <em>is here.</em></h2>
            <div className="new-collection-blank-tiles" aria-label="Collection tiles awaiting their images">
                {[1, 2, 3, 4].map((tile) => <div className="new-collection-blank-tile" aria-label={`New collection preview ${tile}`} key={tile}/>)}
            </div>
        </section>}
    </section>;
}
