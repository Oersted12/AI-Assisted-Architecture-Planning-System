// src/utils/jaffnaBounds.js
// Rough box around Jaffna District (islands included).
// It is only a quick check. The real zone lookup is still done by the backend.

export const JAFFNA_CENTER = { lat: 9.6615, lng: 80.0255 };

const BOUNDS = {
  minLat: 9.0,
  maxLat: 10.0,
  minLng: 79.5,
  maxLng: 80.5,
};

export const isInJaffna = (lat, lng) =>
  lat >= BOUNDS.minLat &&
  lat <= BOUNDS.maxLat &&
  lng >= BOUNDS.minLng &&
  lng <= BOUNDS.maxLng;