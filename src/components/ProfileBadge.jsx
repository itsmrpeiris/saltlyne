import "./ProfileBadge.css";

export default function ProfileBadge({ firstName, lastName, className = "" }) {
    const initials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
    return <span className={`profile-orb ${className}`} aria-hidden="true">{initials}</span>;
}
