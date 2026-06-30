// NOTE: the admin user id intentionally lives ONLY server-side, in the
// ADMIN_UID env var. It must never be shipped to the browser. Admin status is
// resolved by calling /api/admin/verify, and every admin action is re-checked
// server-side.

// Mapbox map defaults. dark-v11 is a clean minimal base (no traffic, no
// road-type colouring); the brightness filter in globals.css lifts it off pure
// black so it sits warmly with the theme.
export const MAP = {
  style: "mapbox://styles/mapbox/dark-v11",
  lng: 21.2087,
  lat: 45.7489,
  zoom: 13,
};

// Supabase Storage bucket for athlete post photos
export const POST_IMAGES_BUCKET = "post-images";

// Canonical sport list used in selects + filters. Add new sports here and they
// flow into the post-event form select and the homepage filter bar automatically.
export const SPORTS = [
  "Basketball",
  "Football",
  "Tennis",
  "Volleyball",
  "Running",
  "Padel",
  "Cycling",
  "Swimming",
  "Baseball",
  "Hockey",
  "Rugby",
  "Cricket",
  "Badminton",
  "Table Tennis",
  "Golf",
  "Skating",
  "Climbing",
  "Boxing",
];

// Filter pill option sets
export const SPORT_FILTERS = ["All", ...SPORTS];
export const TYPE_FILTERS = ["All", "Casual", "Official"];

export const EVENT_TYPES = ["casual", "official"];

export const PIN_COLORS = {
  casual: "#16a34a",
  official: "#f97316",
};

export const EVENTS_PER_PAGE = 6;
