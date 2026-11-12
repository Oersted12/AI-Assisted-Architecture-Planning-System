// services/nominatim.js (React Native)
// Same logic as web but using axios instead of fetch

import axios from "axios";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

const HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "AI-Architecture-App",
};

// Address → lat/lng
export const geocodeAddress = async (address) => {
  const query = encodeURIComponent(`${address}, Jaffna, Sri Lanka`);
  const url   = `${NOMINATIM_BASE}/search?q=${query}&format=json&limit=1`;

  const res = await axios.get(url, { headers: HEADERS });

  if (!res.data || res.data.length === 0) {
    throw new Error("Address not found. Please try a more specific address.");
  }

  return {
    lat:         parseFloat(res.data[0].lat),
    lng:         parseFloat(res.data[0].lon),
    displayName: res.data[0].display_name,
  };
};

// lat/lng → address (called when user stops dragging)
export const reverseGeocode = async (lat, lng) => {
  const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json`;

  const res = await axios.get(url, { headers: HEADERS });

  if (!res.data || res.data.error) {
    return "Unknown location";
  }

  return res.data.display_name;
};