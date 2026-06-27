"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
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
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

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
    <div
      ref={containerRef}
      data-lenis-prevent
      className="h-64 w-full overflow-hidden rounded-xl border border-line"
    />
  );
}
