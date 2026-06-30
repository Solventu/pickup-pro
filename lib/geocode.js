// Shared Mapbox geocoding helpers. Used by the event form and the post composer
// so the "type an address → pin" and "drop a pin → fill the address" flows stay
// identical everywhere.

// Address string -> coordinates + canonical place name.
export async function geocodeLocation(location) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("Mapbox token is not configured.");
  // No country restriction — locations can be anywhere in the world.
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(location)}.json` +
    `?access_token=${token}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Geocoding request failed.");
  const json = await res.json();
  const feature = json.features?.[0];
  if (!feature) return null;
  const [lng, lat] = feature.center;
  return { lng, lat, placeName: feature.place_name };
}

// Coordinates -> a human address, to fill the location field after a map click.
export async function reverseGeocode(lng, lat) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
        `?access_token=${token}&limit=1`
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.features?.[0]?.place_name || null;
  } catch {
    return null;
  }
}
