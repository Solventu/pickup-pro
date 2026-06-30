/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { X, ImageIcon, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { SPORTS, POST_IMAGES_BUCKET } from "@/lib/constants";
import { validateImageFile, randomImageName } from "@/lib/upload";
import { cleanText, LIMITS } from "@/lib/sanitize";
import { reverseGeocode } from "@/lib/geocode";
import Avatar from "./Avatar";
import ImageCropModal from "./ImageCropModal";
import LocationPicker from "./LocationPicker";

const MAX_CHARS = LIMITS.post;
const MAX_LOCATION = LIMITS.location;

export default function PostComposer({ currentUser, profile, onCreated }) {
  const [text, setText] = useState("");
  const [sport, setSport] = useState("");
  const [eventId, setEventId] = useState("");
  const [events, setEvents] = useState([]);
  const [showLocation, setShowLocation] = useState(false);
  const [location, setLocation] = useState(""); // human-readable place label
  const [coords, setCoords] = useState(null); // { lng, lat } from the pin
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [cropSrc, setCropSrc] = useState(""); // original image while cropping
  const [phase, setPhase] = useState("idle"); // "idle" | "checking" | "posting"
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("events")
      .select("id,title")
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (active) setEvents(data || []);
      });
    return () => {
      active = false;
    };
  }, []);

  // Revoke object URLs when they change/unmount
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  // Pick a file → open the square cropper (don't attach the raw file yet).
  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const check = validateImageFile(f);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError("");
    setCropSrc(URL.createObjectURL(f));
    // Allow re-selecting the same file later.
    if (fileRef.current) fileRef.current.value = "";
  };

  // Cropper applied → store the squared JPEG as the post image.
  const onCropped = (blob) => {
    const squared = new File([blob], "crop.jpg", { type: "image/jpeg" });
    setFile(squared);
    setPreview(URL.createObjectURL(squared));
    setCropSrc("");
  };

  const clearFile = () => {
    setFile(null);
    setPreview("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // Pin dropped/moved on the map -> store the coords and auto-fill the place
  // name from reverse geocoding so the input reflects the picked spot. The user
  // can still edit the text afterwards.
  const handlePickLocation = async (c) => {
    setCoords(c);
    const place = await reverseGeocode(c.lng, c.lat);
    if (place) setLocation(place.slice(0, MAX_LOCATION));
  };

  const submit = async (e) => {
    e.preventDefault();
    const description = cleanText(text, LIMITS.post);
    if (!description && !file) {
      setError("Write something or add a photo.");
      return;
    }
    setError("");

    // 1) AI moderation of the text (image-only posts skip it). Fails OPEN: any
    // API/parse error lets the post through so we never block legit content.
    if (description) {
      setPhase("checking");
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const res = await fetch("/api/moderate-post", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ content: description, sport: sport || "" }),
        });
        const verdict = await res.json().catch(() => ({ allowed: true }));
        if (verdict && verdict.allowed === false) {
          setError(
            `Your post couldn't be published: ${
              verdict.reason || "content not allowed."
            }`
          );
          setPhase("idle");
          return;
        }
      } catch {
        // fail open — continue to save
      }
    }

    // 2) Save the post.
    setPhase("posting");
    try {
      let image_url = null;
      if (file) {
        // Random UUID filename; extension from the validated MIME type only.
        const path = `${currentUser.id}/${randomImageName(file)}`;
        const { error: upErr } = await supabase.storage
          .from(POST_IMAGES_BUCKET)
          .upload(path, file, { cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage
          .from(POST_IMAGES_BUCKET)
          .getPublicUrl(path);
        image_url = pub.publicUrl;
      }

      const { data, error: insErr } = await supabase
        .from("athlete_posts")
        .insert({
          user_id: currentUser.id,
          description,
          sport: sport || null,
          event_id: eventId || null,
          image_url,
          location: cleanText(location, LIMITS.location) || null,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      setText("");
      setSport("");
      setEventId("");
      setLocation("");
      setCoords(null);
      setShowLocation(false);
      clearFile();
      onCreated?.(data);
    } catch (err) {
      setError(err.message || "Could not create post.");
    } finally {
      setPhase("idle");
    }
  };

  const remaining = MAX_CHARS - text.length;

  return (
    <form onSubmit={submit} className="card flex flex-col gap-2.5 p-3">
      <div className="flex gap-2.5">
        <Avatar
          username={profile?.username}
          avatarUrl={profile?.avatar_url}
          size={36}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          placeholder="Share a game, a win, a callout…"
          rows={3}
          className="field-textarea h-20 min-h-[80px] flex-1"
        />
      </div>

      {preview && (
        <div className="relative w-fit">
          <img
            src={preview}
            alt="preview"
            className="h-40 w-40 rounded-xl border border-line object-cover"
          />
          <button
            type="button"
            onClick={clearFile}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
            aria-label="Remove image"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
      )}

      {/* Location: a place label others can read + an optional pin they can open
          on a map. Toggled so the composer stays compact by default. */}
      {showLocation && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-bg/40 p-2.5">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="shrink-0 text-accent" aria-hidden />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value.slice(0, MAX_LOCATION))}
              placeholder="Place name (e.g. Central Park Court)"
              className="field-input flex-1 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setShowLocation(false);
                setLocation("");
                setCoords(null);
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted hover:text-fg"
              aria-label="Remove location"
            >
              <X size={15} aria-hidden />
            </button>
          </div>
          <LocationPicker value={coords} onChange={handlePickLocation} />
          <p className="mono text-[0.7rem] text-muted">
            {coords
              ? "Pin set — others can open it on the map."
              : "Tap the map to drop a pin (optional)."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn btn-muted px-2 py-1 text-xs"
        >
          <ImageIcon size={14} aria-hidden /> Photo
        </button>
        <button
          type="button"
          onClick={() => setShowLocation((v) => !v)}
          className={`btn px-2 py-1 text-xs ${
            showLocation || location || coords ? "btn-primary" : "btn-muted"
          }`}
        >
          <MapPin size={14} aria-hidden /> Location
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          className="hidden"
        />

        <select
          value={sport}
          onChange={(e) => setSport(e.target.value)}
          className="field-select w-auto py-1 pl-2 pr-7 text-xs"
          aria-label="Sport tag"
        >
          <option value="">Sport tag…</option>
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="field-select w-auto max-w-[12rem] py-1 pl-2 pr-7 text-xs"
          aria-label="Event tag"
        >
          <option value="">Tag event…</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title}
            </option>
          ))}
        </select>

        <span
          className={`mono ml-auto text-xs ${
            remaining < 0 ? "text-red-400" : "text-muted"
          }`}
        >
          {remaining}
        </span>
        <button
          type="submit"
          disabled={phase !== "idle" || (!text.trim() && !file)}
          className="btn btn-primary px-3 py-1 text-xs"
        >
          {phase === "checking"
            ? "Checking content…"
            : phase === "posting"
            ? "Posting…"
            : "Post"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <ImageCropModal
        open={!!cropSrc}
        src={cropSrc}
        onCancel={() => setCropSrc("")}
        onCropped={onCropped}
      />
    </form>
  );
}
