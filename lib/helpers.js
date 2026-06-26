// "2026-06-14" -> "Sun, 14 Jun"
export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

// "18:00:00" / "18:00" -> "18:00"
export function formatTime(timeStr) {
  if (!timeStr) return "";
  return String(timeStr).slice(0, 5);
}

// ISO timestamp -> compact relative time ("now", "3m", "5h", "2d", "12 Jun")
export function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 45) return "now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
  if (secs < 604800) return `${Math.floor(secs / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

// First letters for avatar fallback
export function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic accent color from a string (avatar bg fallback)
export function colorFromString(str) {
  const palette = ["#16a34a", "#0ea5e9", "#f97316", "#a855f7", "#e11d48", "#eab308"];
  let h = 0;
  for (let i = 0; i < String(str).length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return palette[h % palette.length];
}

// Escape Postgres LIKE/ILIKE wildcards (% _ \) so a value matches literally.
// Needed because usernames may contain underscores, which are LIKE wildcards.
export function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, "\\$&");
}

// Broadcast that the current user's follow relationships changed, so any
// mounted view that depends on them (e.g. the "following" feed) can refetch.
// Decouples the many follow/unfollow buttons from the screens they affect.
export const FOLLOWS_CHANGED = "follows:changed";
export function emitFollowsChanged() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(FOLLOWS_CHANGED));
}

// An event is mappable only if it has real coordinates. 0,0 is the default
// fallback for events that were never geocoded, so it counts as invalid.
export function hasValidCoords(ev) {
  const lat = Number(ev?.latitude);
  const lng = Number(ev?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0;
}
