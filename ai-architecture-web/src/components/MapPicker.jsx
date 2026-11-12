// src/components/MapPicker.jsx

import React, { useState, useCallback, useRef, useEffect } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { reverseGeocode } from "../services/nominatim";
import "leaflet/dist/leaflet.css";

const FixedPin = () => (
  <div style={{
    position:      "absolute",
    top:           "50%",
    left:          "50%",
    transform:     "translate(-50%, -100%)",
    zIndex:        1000,
    pointerEvents: "none",
  }}>
    <svg width="36" height="48" viewBox="0 0 36 48" fill="none"
         xmlns="http://www.w3.org/2000/svg">
      <path d="M18 0C8.06 0 0 8.06 0 18C0 31.5 18 48 18 48C18 48 36 31.5 36 18C36 8.06 27.94 0 18 0Z"
            fill="#1A3C5E"/>
      <circle cx="18" cy="18" r="8" fill="white"/>
      <circle cx="18" cy="18" r="4" fill="#F0A500"/>
    </svg>
  </div>
);

const DragDetector = ({ onDragEnd }) => {
  useMapEvents({
    moveend: (e) => {
      const center = e.target.getCenter();
      onDragEnd(center.lat, center.lng);
    },
  });
  return null;
};

const MapPicker = ({ initialLat, initialLng, onLocationConfirmed, onBack }) => {
  const [address, setAddress] = useState("Fetching address...");
  const [lat, setLat]         = useState(initialLat);
  const [lng, setLng]         = useState(initialLng);
  const [loading, setLoading] = useState(false);
  const debounceRef           = useRef(null);

  useEffect(() => {
  let cancelled = false;
  (async () => {
    setLoading(true);
    try {
      const addr = await reverseGeocode(initialLat, initialLng);
      if (!cancelled) setAddress(addr);
    } catch {
      if (!cancelled) setAddress("Could not fetch address");
    } finally {
      if (!cancelled) setLoading(false);
    }
  })();
  return () => { cancelled = true; };
}, [initialLat, initialLng]);

  const handleDragEnd = useCallback(async (newLat, newLng) => {
    setLat(newLat);
    setLng(newLng);
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const addr = await reverseGeocode(newLat, newLng);
        setAddress(addr);
      } catch {
        setAddress("Could not fetch address");
      } finally {
        setLoading(false);
      }
    }, 600);
  }, []);

  const handleConfirm = () => {
    onLocationConfirmed({ lat, lng, address });
  };

  const canConfirm = !loading && address !== "Fetching address...";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>

      {/* ── Map ── */}
      <MapContainer
        center={[initialLat, initialLng]}
        zoom={19}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        {/* CartoDB Voyager — shows roads, lanes, landmarks, shops, churches */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <DragDetector onDragEnd={handleDragEnd} />
      </MapContainer>

      {/* ── Fixed center pin ── */}
      <FixedPin />

      {/* ── Address bar (top) — fixed height, no overlap ── */}
      <div style={{
        position:     "absolute",
        top:          12,
        left:         12,
        right:        12,
        zIndex:       1000,
        background:   "white",
        borderRadius: 10,
        padding:      "10px 14px",
        boxShadow:    "0 2px 12px rgba(0,0,0,0.2)",
        fontFamily:   "Arial, sans-serif",
      }}>
        {/* Top row: label + back button */}
        <div style={{
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
          marginBottom:   4,
        }}>
          <span style={{ fontWeight: "bold", color: "#F0A500", fontSize: 13 }}>
            📍 Selected Location
          </span>
          <button
            onClick={onBack}
            style={{
              background:   "#1A3C5E",
              color:        "white",
              border:       "none",
              borderRadius: 6,
              padding:      "4px 12px",
              fontSize:     12,
              cursor:       "pointer",
              fontWeight:   "bold",
            }}
          >
            ← Back
          </button>
        </div>

        {/* Address text */}
        <div style={{ color: "#333", fontSize: 12, lineHeight: 1.4 }}>
          {loading ? "Fetching address..." : address}
        </div>

        {/* Coordinates */}
        <div style={{ color: "#888", fontSize: 11, marginTop: 4 }}>
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </div>
      </div>

      {/* ── Drag hint ── */}
      <div style={{
        position:      "absolute",
        top:           "50%",
        left:          "50%",
        transform:     "translate(-50%, 30px)",
        zIndex:        999,
        background:    "rgba(26,60,94,0.80)",
        color:         "white",
        padding:       "4px 14px",
        borderRadius:  20,
        fontSize:      11,
        fontFamily:    "Arial, sans-serif",
        pointerEvents: "none",
        whiteSpace:    "nowrap",
      }}>
        Drag map to adjust pin
      </div>

      {/* ── Confirm button (bottom) ── */}
      <div style={{
        position: "absolute",
        bottom:   24,
        left:     16,
        right:    16,
        zIndex:   1000,
      }}>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm}
          style={{
            width:        "100%",
            padding:      "14px 0",
            background:   canConfirm ? "#1A3C5E" : "#AEB6BF",
            color:        "white",
            border:       "none",
            borderRadius: 10,
            fontSize:     15,
            fontWeight:   "bold",
            cursor:       canConfirm ? "pointer" : "not-allowed",
            fontFamily:   "Arial, sans-serif",
            boxShadow:    "0 4px 12px rgba(26,60,94,0.4)",
          }}
        >
          ✅ Confirm This Location
        </button>
      </div>

    </div>
  );
};

export default MapPicker;