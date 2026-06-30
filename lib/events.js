import { supabase } from "./supabaseClient";

// Delete an event as the admin. The /api/admin/delete-event route re-verifies the
// caller is the admin server-side; here we just forward the caller's Supabase
// access token so it can. A client-side admin flag is never trusted for the
// actual deletion.
export async function deleteEventAsAdmin(eventId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch("/api/admin/delete-event", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ eventId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Could not delete event.");
  }
  return res.json();
}
