// Shared input sanitization.
// Text is stored as plain text and rendered through React (which escapes), but
// we still strip tags + clamp lengths before saving as defense-in-depth and to
// keep the database clean.

export const LIMITS = {
  post: 500,
  comment: 500,
  username: 20,
  bio: 160,
  location: 120,
};

// Username: letters, numbers and underscores only, 3–20 chars.
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// Remove HTML tags (e.g. "<script>…</script>", "<b>") from a string.
export function stripHtml(value) {
  return String(value ?? "").replace(/<[^>]*>/g, "");
}

// Trim, strip HTML tags, and clamp to maxLen (when provided). Use this for any
// free-text field before persisting it.
export function cleanText(value, maxLen) {
  let out = stripHtml(value).trim();
  if (typeof maxLen === "number" && out.length > maxLen) {
    out = out.slice(0, maxLen);
  }
  return out;
}

export function sanitizeUsername(value) {
  return String(value ?? "").trim();
}

export function isValidUsername(value) {
  return USERNAME_RE.test(sanitizeUsername(value));
}
