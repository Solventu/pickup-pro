"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Plus, Minus } from "lucide-react";
import { MAP } from "@/lib/constants";
import { formatTime, hasValidCoords } from "@/lib/helpers";

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// Inline lucide-style icons for the popup (raw HTML can't import React icons).
const SVG = {
  clock:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  pin:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  users:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
};

function popupRow(svg, text) {
  return `<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-flex">${svg}</span><span>${text}</span></div>`;
}

function popupHtml(ev) {
  const isOfficial = ev.type === "official";
  const color = isOfficial ? "#fb923c" : "#22c55e";
  return `
    <div style="min-width:190px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="width:8px;height:8px;border-radius:9999px;background:${color};display:inline-block"></span>
        <span style="font-family:var(--font-dm-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:${color}">
          ${isOfficial ? "Official" : "Casual"}${ev.sport ? " · " + escapeHtml(ev.sport) : ""}
        </span>
      </div>
      <div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#e8e8f2">${escapeHtml(ev.title)}</div>
      <div style="font-family:var(--font-dm-mono);font-size:12px;color:#9b9bb3;line-height:1.7;display:flex;flex-direction:column;gap:2px">
        ${popupRow(SVG.clock, escapeHtml(formatTime(ev.time)))}
        ${popupRow(SVG.pin, escapeHtml(ev.location || "—"))}
        ${popupRow(SVG.users, `${ev.count ?? 0}${ev.max_players ? " / " + ev.max_players : ""} players`)}
      </div>
    </div>`;
}

export default function MapView({ events = [], flyToRef, className = "" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  // Whether we've already framed the events once. Prevents realtime updates from
  // yanking the camera back to fit-bounds after the user has panned/zoomed.
  const fittedRef = useRef(false);

  // Initialize the map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.warn("[PickupPro] Missing NEXT_PUBLIC_MAPBOX_TOKEN — map disabled.");
      return;
    }
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP.style,
      // Flat (mercator) instead of the globe so the map fills the whole frame —
      // no black "space" void around a sphere.
      projection: "mercator",
      // Default to a world view; the markers effect fits bounds to real events.
      center: [10, 25],
      zoom: 1.3,
      // Drop Mapbox's default chrome (logo, attribution, nav control). We render
      // our own zoom buttons below to match the site's design.
      attributionControl: false,
    });
    mapRef.current = map;

    // Blend the base map into the warm navy theme: land takes the page bg, water
    // a touch lighter — so the map reads as part of the site, not a grey box.
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

    if (flyToRef) {
      flyToRef.current = (ev) => {
        if (!hasValidCoords(ev)) return;
        map.flyTo({
          center: [Number(ev.longitude), Number(ev.latitude)],
          zoom: 15.5,
          speed: 1.2,
          essential: true,
        });
        const marker = markersRef.current[ev.id];
        if (marker && !marker.getPopup().isOpen()) marker.togglePopup();
      };
    }

    // Keep the canvas matched to the container. The map can mount before the
    // container has reached its final height (e.g. inside the reveal/toggle),
    // which otherwise leaves an unpainted strip at the bottom.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
  }, [flyToRef]);

  // Render / refresh markers when the (filtered) events change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const coords = [];
    events.forEach((ev) => {
      // Only place a pin when the event has real coordinates (not null/0,0).
      if (!hasValidCoords(ev)) return;
      const lngLat = [Number(ev.longitude), Number(ev.latitude)];
      coords.push(lngLat);
      const el = document.createElement("div");
      el.className = `event-pin ${
        ev.type === "official" ? "event-pin-official" : "event-pin-casual"
      }`;
      const popup = new mapboxgl.Popup({ offset: 16, closeButton: true }).setHTML(
        popupHtml(ev)
      );
      const marker = new mapboxgl.Marker(el)
        .setLngLat(lngLat)
        .setPopup(popup)
        .addTo(map);
      markersRef.current[ev.id] = marker;
    });

    // Frame all pins worldwide on first population. A single event centers on it;
    // many events fit to their bounding box; none leaves the default world view.
    if (!fittedRef.current && coords.length) {
      if (coords.length === 1) {
        map.easeTo({ center: coords[0], zoom: 12, duration: 0 });
      } else {
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, { padding: 64, maxZoom: 13, duration: 0 });
      }
      fittedRef.current = true;
    }
  }, [events]);

  return (
    <div className="relative">
      <div ref={containerRef} className={className} />

      {/* Custom zoom controls — styled to match the site instead of Mapbox's
          default white +/- buttons. */}
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
    </div>
  );
}
