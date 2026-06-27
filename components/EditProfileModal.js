/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import Avatar from "./Avatar";
import { supabase } from "@/lib/supabaseClient";
import { POST_IMAGES_BUCKET, SPORTS } from "@/lib/constants";
import { escapeLike } from "@/lib/helpers";
import { validateImageFile, randomImageName } from "@/lib/upload";
import { cleanText, LIMITS, isValidUsername, sanitizeUsername } from "@/lib/sanitize";

export default function EditProfileModal({ open, onClose, profile, onSaved }) {
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [sport, setSport] = useState("");
  const [location, setLocation] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (open && profile) {
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setSport(profile.sport || "");
      setLocation(profile.location || "");
      setIsPrivate(!!profile.is_private);
      setAvatarUrl(profile.avatar_url || "");
      setFile(null);
      setPreview("");
      setError("");
    }
  }, [open, profile]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const check = validateImageFile(f);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    setError("");
    const uname = sanitizeUsername(username);
    if (!isValidUsername(uname)) {
      setError("Username must be 3–20 letters, numbers, or underscores.");
      return;
    }
    setSaving(true);
    try {
      if (uname.toLowerCase() !== (profile.username || "").toLowerCase()) {
        const { data: taken } = await supabase
          .from("profiles")
          .select("id")
          .ilike("username", escapeLike(uname))
          .neq("id", profile.id)
          .limit(1);
        if (taken && taken.length) {
          setError("Username already taken.");
          setSaving(false);
          return;
        }
      }

      let newAvatar = avatarUrl;
      if (file) {
        // Random UUID filename; extension from the validated MIME type only.
        const path = `${profile.id}/${randomImageName(file)}`;
        const { error: upErr } = await supabase.storage
          .from(POST_IMAGES_BUCKET)
          .upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        newAvatar = supabase.storage
          .from(POST_IMAGES_BUCKET)
          .getPublicUrl(path).data.publicUrl;
      }

      const updates = {
        username: uname,
        bio: cleanText(bio, LIMITS.bio) || null,
        sport: sport || null,
        location: cleanText(location, 80) || null,
        avatar_url: newAvatar || null,
        is_private: isPrivate,
      };
      const { error: updErr } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id);
      if (updErr) throw updErr;

      onSaved?.({ ...profile, ...updates });
      onClose?.();
    } catch (err) {
      setError(err.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit profile">
      <div className="flex flex-col gap-4">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          {preview ? (
            <img
              src={preview}
              alt="avatar preview"
              className="h-16 w-16 rounded-full border border-line object-cover"
            />
          ) : (
            <Avatar username={username} avatarUrl={avatarUrl} size={64} />
          )}
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn btn-muted"
            >
              Change avatar
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onPickFile}
              className="hidden"
            />
          </div>
        </div>

        <div>
          <label className="field-label">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="field-input"
            maxLength={20}
          />
        </div>

        <div>
          <label className="field-label">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="field-textarea"
            rows={3}
            maxLength={LIMITS.bio}
            placeholder="Tell people about yourself…"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Main sport</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="field-select"
            >
              <option value="">—</option>
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="field-input"
              placeholder="Your city"
            />
          </div>
        </div>

        {/* Private toggle */}
        <button
          type="button"
          onClick={() => setIsPrivate((v) => !v)}
          className="flex items-center justify-between rounded-lg border border-line px-4 py-3 text-left"
        >
          <span>
            <span className="block text-sm font-medium text-fg">
              Private account
            </span>
            <span className="text-xs text-muted">
              Followers must be approved to see your posts.
            </span>
          </span>
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              isPrivate ? "bg-accent" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                isPrivate ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-muted" disabled={saving}>
            Cancel
          </button>
          <button onClick={save} className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
