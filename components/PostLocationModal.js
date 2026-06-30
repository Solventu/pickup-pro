"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { X, MapPin, Plus, Minus } from "lucide-react";
import { MAP } from "@/lib/constants";
import { geocodeLocation } from "@/lib/geocode";

// In-app viewer for a post's location. Shows our themed Mapbox map with a pin at
// the post's coordinates — no external redirect. If the post only has a text
// location (no pin), the address is geocoded on open so we can still center it.
export default function PostLocationModal({ open, onClose, post }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [coords, setCoords] = useState(
    post?.latitude != null && post?.longitude != null
      ? { lng: post.longitude, lat: post.latitude }
      : null
  );
  const [resolving, setResolving] = useState(false);
  const label = post?.location || "Location";

  // ESC + scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // No pin coords but a text location -> geocode it so we have something to show.
  useEffect(() => {
    if (!open || coords || !post?.location) return;
    let active = true;
    setResolving(true);
    geocodeLocation(post.location)
      .then((geo) => {
        if (active && geo) setCoords({ lng: geo.lng, lat: geo.lat });
      })
      .catch(() => {})
      .finally(() => active && setResolving(false));
    return () => {
      active = false;
    };
  }, [open, coords, post?.location]);

  // Init the map once we're open and have coordinates.
  useEffect(() => {
    if (!open || !coords || !containerRef.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP.style,
      projection: "mercator",
      center: [coords.lng, coords.lat],
      zoom: 14,
      attributionControl: false,
      interactive: true,
    });
    mapRef.current = map;

    // Same recolor as the homepage map so it reads as part of the site.
    map.on("style.load", () => {
      const set = (id, prop, val) => {
        try {
          if (map.getLayer(id)) map.setPaintProperty(id, prop, val);
        } catch {}
      };
      (map.getStyle().layers || []).forEach((l) => {
        if (l.type === "background") set(l.id, "background-color", "#1a1b26");
        else if (l.type === "fill" && /water|ocean|bathymetry/i.test(l.id))
          set(l.id, "fill-color", "#262838");
      });
    });

    new mapboxgl.Marker({ color: "#22c55e" })
      .setLngLat([coords.lng, coords.lat])
      .addTo(map);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [open, coords]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-line p-4">
          <h3 className="flex min-w-0 items-center gap-2 text-sm font-medium text-fg">
            <MapPin size={16} className="shrink-0 text-accent" aria-hidden />
            <span className="truncate">{label}</span>
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-muted transition-colors hover:text-fg"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="relative">
          <div
            ref={containerRef}
            data-lenis-prevent
            className="h-80 w-full bg-bg"
          />
          {!coords && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="mono text-sm text-muted">
                {resolving ? "Locating…" : "No map location available."}
              </p>
            </div>
          )}

          {coords && (
            <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-lg border border-line bg-bg/80 backdrop-blur-md shadow-lg">
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => mapRef.current?.zoomIn()}
                className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:bg-accent/15 hover:text-accent"
              >
                <Plus size={16} aria-hidden />
              </button>
              <span className="h-px w-full bg-line" aria-hidden />
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => mapRef.current?.zoomOut()}
                className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:bg-accent/15 hover:text-accent"
              >
                <Minus size={16} aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
