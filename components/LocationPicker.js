"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Plus, Minus } from "lucide-react";
import { MAP } from "@/lib/constants";

// Click-to-pick location map for the event form. Clicking (or dragging the pin)
// reports { lng, lat } via onChange. `value` may also be set externally (e.g.
// after geocoding a typed address) to move the pin.
export default function LocationPicker({ value, onChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  // Keep the latest onChange without re-running the map-init effect.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Place or move the draggable marker.
  const placeMarker = (map, lngLat) => {
    if (!markerRef.current) {
      markerRef.current = new mapboxgl.Marker({ color: "#22c55e", draggable: true })
        .setLngLat(lngLat)
        .addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current.getLngLat();
        onChangeRef.current?.({ lng: p.lng, lat: p.lat });
      });
    } else {
      markerRef.current.setLngLat(lngLat);
    }
  };

  // Init once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP.style,
      projection: "mercator",
      center: value ? [value.lng, value.lat] : [MAP.lng, MAP.lat],
      zoom: value ? 14 : 11,
    });
    mapRef.current = map;

    // Match the homepage map: land takes the page bg, water a touch lighter, so
    // the picker reads as part of the site instead of a stock-grey Mapbox map.
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

    if (value) placeMarker(map, [value.lng, value.lat]);

    map.on("click", (e) => {
      placeMarker(map, [e.lngLat.lng, e.lngLat.lat]);
      onChangeRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the pin when value changes from outside (e.g. address geocoded).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    placeMarker(map, [value.lng, value.lat]);
    map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 13) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lng, value?.lat]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        data-lenis-prevent
        className="h-64 w-full overflow-hidden rounded-xl border border-line"
      />

      {/* Custom zoom controls — same look as the homepage map (green-on-hover),
          instead of Mapbox's default white +/- buttons. */}
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
