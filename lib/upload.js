// Shared client-side image upload validation + safe storage filenames.
// Used by the post composer and the profile-avatar uploader.

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Validate a picked File: must be an image, an allowed format, and under 5 MB.
// Returns { ok: true } or { ok: false, error: "<message>" }.
export function validateImageFile(file) {
  if (!file) return { ok: false, error: "Alege un fișier imagine." };
  if (
    !file.type ||
    !file.type.startsWith("image/") ||
    !ALLOWED_IMAGE_TYPES.includes(file.type)
  ) {
    return {
      ok: false,
      error: "Doar fișiere imagine sunt acceptate (JPG, PNG, WEBP, GIF)",
    };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Imaginea nu poate depăși 5MB" };
  }
  return { ok: true };
}

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID.
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

// Build a random, collision-resistant storage filename. The extension is
// derived from the validated MIME type — NEVER from the user-supplied filename —
// so a crafted name like "x.png/../../other" can't smuggle path segments
// (path traversal).
export function randomImageName(file) {
  const ext = EXT_BY_TYPE[file?.type] || "jpg";
  return `${randomId()}.${ext}`;
}
