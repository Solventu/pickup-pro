"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import { SPORTS, MAP } from "@/lib/constants";
import { cleanText } from "@/lib/sanitize";

async function geocodeLocation(location) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("Mapbox token is not configured.");
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(location)}.json` +
    `?access_token=${token}&limit=1&country=ro&proximity=${MAP.lng},${MAP.lat}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding request failed.");
  const json = await res.json();
  const feature = json.features?.[0];
  if (!feature) return null;
  const [lng, lat] = feature.center;
  return { lng, lat, placeName: feature.place_name };
}

export default function PostEventPage() {
  const router = useRouter();
  // Admin status is verified server-side via /api/admin/verify (through the auth
  // provider). Wait for that check before deciding whether to redirect.
  const { isAdmin, loading: authLoading, adminLoading } = useAuth();

  const [form, setForm] = useState({
    sport: SPORTS[0],
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    max_players: 10,
    type: "casual",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !adminLoading && !isAdmin) router.replace("/");
  }, [authLoading, adminLoading, isAdmin, router]);

  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const location = cleanText(form.location, 120);
      const geo = await geocodeLocation(location);
      if (!geo) {
        setError(
          "Couldn’t find that location. Try a more specific address in Timișoara."
        );
        setSubmitting(false);
        return;
      }

      const { error: insErr } = await supabase.from("events").insert({
        sport: form.sport,
        title: cleanText(form.title, 120),
        description: cleanText(form.description, 1000) || null,
        date: form.date,
        time: form.time,
        location,
        latitude: geo.lat,
        longitude: geo.lng,
        max_players: Number(form.max_players) || null,
        type: form.type,
        source: "admin",
      });
      if (insErr) throw insErr;

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message || "Could not create event.");
      setSubmitting(false);
    }
  };

  if (authLoading || adminLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="h-72 animate-pulse rounded-2xl border border-line bg-card" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-2xl font-bold">Access denied</p>
        <p className="mt-2 text-sm text-muted">
          Only the admin can post events.
        </p>
        <Link href="/" className="btn btn-outline mt-6">
          Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <span className="badge badge-official">Admin</span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Post an event</h1>
        <p className="mt-2 text-sm text-muted">
          The location is geocoded automatically and pinned on the map.
        </p>
      </div>

      <form onSubmit={submit} className="card flex flex-col gap-4 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">Sport</label>
            <select
              value={form.sport}
              onChange={update("sport")}
              className="field-select"
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Type</label>
            <select
              value={form.type}
              onChange={update("type")}
              className="field-select"
            >
              <option value="casual">Casual</option>
              <option value="official">Official</option>
            </select>
          </div>
        </div>

        <div>
          <label className="field-label">Title</label>
          <input
            required
            value={form.title}
            onChange={update("title")}
            className="field-input"
            placeholder="Sunday 5-a-side"
          />
        </div>

        <div>
          <label className="field-label">Description</label>
          <textarea
            value={form.description}
            onChange={update("description")}
            className="field-textarea"
            rows={3}
            placeholder="Details, level, what to bring…"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label">Date</label>
            <input
              required
              type="date"
              value={form.date}
              onChange={update("date")}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">Time</label>
            <input
              required
              type="time"
              value={form.time}
              onChange={update("time")}
              className="field-input"
            />
          </div>
        </div>

        <div>
          <label className="field-label">Location</label>
          <input
            required
            value={form.location}
            onChange={update("location")}
            className="field-input"
            placeholder="Parcul Central, Timișoara"
          />
          <p className="mono mt-1.5 text-xs text-muted">
            Geocoded via Mapbox on submit.
          </p>
        </div>

        <div className="w-40">
          <label className="field-label">Max players</label>
          <input
            required
            type="number"
            min={1}
            value={form.max_players}
            onChange={update("max_players")}
            className="field-input"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary mt-1 w-full"
        >
          {submitting ? "Creating event…" : "Post event"}
        </button>
      </form>
    </div>
  );
}
