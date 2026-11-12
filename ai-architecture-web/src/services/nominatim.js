// src/services/nominatim.js
// Handles all Nominatim (OpenStreetMap) API calls — no API key needed

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

// Address → lat/lng
export const geocodeAddress = async (address) => {
  const query = encodeURIComponent(`${address}, Jaffna, Sri Lanka`);
  const url   = `${NOMINATIM_BASE}/search?q=${query}&format=json&limit=1`;

  const res  = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "AI-Architecture-App" }
  });
  const data = await res.json();

  if (!data || data.length === 0) {
    throw new Error("Address not found. Please try a more specific address.");
  }

  return {
    lat:         parseFloat(data[0].lat),
    lng:         parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
};

// lat/lng → address (called when user drags the map)
export const reverseGeocode = async (lat, lng) => {
  const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json`;

  const res  = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "AI-Architecture-App" }
  });
  const data = await res.json();

  if (!data || data.error) {
    return "Unknown location";
  }

  return data.display_name;
};