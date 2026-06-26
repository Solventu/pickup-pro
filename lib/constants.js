// NOTE: the admin user id intentionally lives ONLY server-side, in the
// ADMIN_UID env var. It must never be shipped to the browser. Admin status is
// resolved by calling /api/admin/verify, and every admin action is re-checked
// server-side.

// Mapbox / Timișoara map defaults
export const MAP = {
  style: "mapbox://styles/mapbox/dark-v11",
  lng: 21.2087,
  lat: 45.7489,
  zoom: 13,
};

// Supabase Storage bucket for athlete post photos
export const POST_IMAGES_BUCKET = "post-images";

// Canonical sport list used in selects + filters
export const SPORTS = [
  "Basketball",
  "Football",
  "Tennis",
  "Volleyball",
  "Running",
];

// Filter pill option sets (Romanian "Toate" = "All")
export const SPORT_FILTERS = ["Toate", ...SPORTS];
export const TYPE_FILTERS = ["Toate", "Casual", "Official"];

export const EVENT_TYPES = ["casual", "official"];

export const PIN_COLORS = {
  casual: "#16a34a",
  official: "#f97316",
};

export const EVENTS_PER_PAGE = 6;
