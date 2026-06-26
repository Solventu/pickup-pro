"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAP } from "@/lib/constants";
import { formatTime, hasValidCoords } from "@/lib/helpers";

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function popupHtml(ev) {
  const isOfficial = ev.type === "official";
  const color = isOfficial ? "#f97316" : "#16a34a";
  return `
    <div style="min-width:190px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <span style="width:8px;height:8px;border-radius:9999px;background:${color};display:inline-block"></span>
        <span style="font-family:var(--font-dm-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:${color}">
          ${isOfficial ? "Official" : "Casual"}${ev.sport ? " · " + escapeHtml(ev.sport) : ""}
        </span>
      </div>
      <div style="font-weight:600;font-size:14px;margin-bottom:6px;color:#f0f6ff">${escapeHtml(ev.title)}</div>
      <div style="font-family:var(--font-dm-mono);font-size:12px;color:#8b949e;line-height:1.7">
        <div>🕘 ${escapeHtml(formatTime(ev.time))}</div>
        <div>📍 ${escapeHtml(ev.location || "—")}</div>
        <div>👥 ${ev.count ?? 0}${ev.max_players ? " / " + ev.max_players : ""} players</div>
      </div>
    </div>`;
}

export default function MapView({ events = [], flyToRef, className = "" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});

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
      center: [MAP.lng, MAP.lat],
      zoom: MAP.zoom,
    });
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    mapRef.current = map;

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

    return () => {
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

    events.forEach((ev) => {
      // Only place a pin when the event has real coordinates (not null/0,0).
      if (!hasValidCoords(ev)) return;
      const el = document.createElement("div");
      el.className = `event-pin ${
        ev.type === "official" ? "event-pin-official" : "event-pin-casual"
      }`;
      const popup = new mapboxgl.Popup({ offset: 16, closeButton: true }).setHTML(
        popupHtml(ev)
      );
      const marker = new mapboxgl.Marker(el)
        .setLngLat([Number(ev.longitude), Number(ev.latitude)])
        .setPopup(popup)
        .addTo(map);
      markersRef.current[ev.id] = marker;
    });
  }, [events]);

  return <div ref={containerRef} className={className} />;
}
