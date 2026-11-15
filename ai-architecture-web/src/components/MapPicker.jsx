// src/components/MapPicker.jsx

import React, { useState, useCallback, useRef, useEffect } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import { reverseGeocode } from "../services/nominatim";
import { isInJaffna } from "../utils/jaffnaBounds";
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
  const [address, setAddress]       = useState("Fetching address...");
  const [addressOk, setAddressOk]   = useState(false); // true only when address matches the current pin
  const [lat, setLat]               = useState(initialLat);
  const [lng, setLng]               = useState(initialLng);
  const [loading, setLoading]       = useState(true);
  const debounceRef                 = useRef(null);
  const requestId                   = useRef(0);       // used to ignore old (stale) answers

  // One function does all address lookups.
  // Only the newest request is allowed to change the screen.
  const fetchAddress = useCallback(async (la, ln) => {
    const myId = ++requestId.current;
    setLoading(true);
    setAddressOk(false);
    try {
      const addr = await reverseGeocode(la, ln);
      if (myId !== requestId.current) return; // an newer request exists, ignore this one
      setAddress(addr);
      setAddressOk(true);
    } catch {
      if (myId !== requestId.current) return;
      setAddress("Could not fetch address");
      setAddressOk(false);
    } finally {
      if (myId === requestId.current) setLoading(false);
    }
  }, []);

  // First address lookup when the map opens
  useEffect(() => {
    fetchAddress(initialLat, initialLng);
    return () => {
      clearTimeout(debounceRef.current);
      requestId.current++; // cancel anything still running
    };
  }, [initialLat, initialLng, fetchAddress]);

  // When the user moves the map
  const handleDragEnd = useCallback((newLat, newLng) => {
    setLat(newLat);
    setLng(newLng);
    setAddressOk(false);   // old address no longer matches the pin
    setLoading(true);
    requestId.current++;   // cancel any older request
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchAddress(newLat, newLng), 600);
  }, [fetchAddress]);

  const handleConfirm = () => {
    onLocationConfirmed({ lat, lng, address });
  };

  const canConfirm = addressOk && !loading;
  const outside    = !isInJaffna(lat, lng);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>

      {/* ── Map ── */}
      <MapContainer
        center={[initialLat, initialLng]}
        zoom={19}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        <DragDetector onDragEnd={handleDragEnd} />
      </MapContainer>

      {/* ── Fixed center pin ── */}
      <FixedPin />

      {/* ── Address bar (top) ── */}
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
          {!loading && !addressOk && (
            <button
              onClick={() => fetchAddress(lat, lng)}
              style={{
                marginLeft:   8,
                background:   "none",
                border:       "none",
                color:        "#1A3C5E",
                fontWeight:   "bold",
                fontSize:     12,
                cursor:       "pointer",
                textDecoration: "underline",
              }}
            >
              Retry
            </button>
          )}
        </div>

        {/* Coordinates */}
        <div style={{ color: "#888", fontSize: 11, marginTop: 4 }}>
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </div>

        {/* Outside Jaffna warning */}
        {outside && (
          <div style={{
            marginTop:    8,
            background:   "#FEF5E7",
            color:        "#9A6700",
            fontSize:     12,
            padding:      "6px 10px",
            borderRadius: 6,
            lineHeight:   1.4,
          }}>
            ⚠️ This spot is outside Jaffna District. Drag the map to your land.
          </div>
        )}
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