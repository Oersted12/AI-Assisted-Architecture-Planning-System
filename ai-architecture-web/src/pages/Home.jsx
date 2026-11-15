// src/pages/Home.jsx
import React, { useState, useEffect } from "react";
import MapPicker from "../components/MapPicker";
import LandDetailsForm from "./LandDetailsForm";
import { geocodeAddress, reverseGeocode } from "../services/nominatim";
import ResultsPage from "./ResultsPage";
import { predictPlan } from "../services/api";
import { isInJaffna, JAFFNA_CENTER } from "../utils/jaffnaBounds";

const HISTORY_KEY = "ai_arch_location_history";
const MAX_HISTORY = 5;

const Home = () => {
  const [address, setAddress]       = useState("");
  const [mapCoords, setMapCoords]   = useState(null);
  const [confirmed, setConfirmed]   = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError]           = useState("");
  const [history, setHistory]       = useState([]);
  const [result, setResult]         = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedInputs, setSubmittedInputs] = useState(null);

  // ── Load history + auto GPS on mount ─────────────────────────────────────
  useEffect(() => {
    loadHistory();
    detectGPS();
  }, []);

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      setHistory([]);
    }
  };

  const saveToHistory = (location) => {
    try {
      const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      const filtered = existing.filter((h) => h.address !== location.address);
      const updated  = [location, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      setHistory(updated);
    } catch {}
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  // ── GPS detection ─────────────────────────────────────────────────────────
  const detectGPS = () => {
    if (!navigator.geolocation) {
      setError("GPS not supported on this device.");
      return;
    }
    setGpsLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Laptops often guess a wrong place (for example Colombo).
        // If the point is outside Jaffna, do not open the map there.
        if (!isInJaffna(lat, lng)) {
          setGpsLoading(false);
          setError(
            "Your device says you are outside Jaffna District " +
            `(${lat.toFixed(3)}, ${lng.toFixed(3)}, about ${Math.round(position.coords.accuracy)} m accuracy). ` +
            "Laptop location can be wrong. Please type your land address below."
          );
          return;
        }

        try {
          const addr = await reverseGeocode(lat, lng);
          setMapCoords({ lat, lng });
          setAddress(addr);
        } catch {
          setMapCoords({ lat, lng });
        } finally {
          setGpsLoading(false);
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) {
          setError("Location access denied. Please type your address below.");
        } else {
          setError("Could not detect location. Please type your address.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ── Manual search ─────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!address.trim()) return;
    setError("");
    setLoading(true);
    try {
      const found = await geocodeAddress(address);
      setMapCoords(found);
      setConfirmed(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Confirm location ──────────────────────────────────────────────────────
  const handleConfirmed = (location) => {
    const locationWithTime = { ...location, savedAt: new Date().toISOString() };
    setConfirmed(locationWithTime);
    setMapCoords(null);
    saveToHistory(locationWithTime);
  };

  // ── Tap history item ──────────────────────────────────────────────────────
  const handleHistoryTap = (item) => {
    setMapCoords({ lat: item.lat, lng: item.lng });
    setConfirmed(null);
  };

  // ── Format date ───────────────────────────────────────────────────────────
  const formatDate = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  };

  const handleFormSubmit = async (data) => {
    setSubmitting(true);
    try {
      const res = await predictPlan(data);
      setResult(res);
      setSubmittedInputs(data);
    } catch (e) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Land details form screen ──────────────────────────────────────────────
  if (showForm && confirmed) {
    return (
      <>
        <div style={{ display: result ? "none" : "block" }}>
          <LandDetailsForm
            location={confirmed}
            onBack={() => setShowForm(false)}
            onSubmit={handleFormSubmit}
          />
        </div>

        {result && (
          <ResultsPage
            result={result}
            inputs={submittedInputs}
            address={confirmed.address}
            onEdit={() => setResult(null)}
            onNewPlan={() => {
              setResult(null);
              setShowForm(false);
              setConfirmed(null);
            }}
          />
        )}

        {submitting && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(26,60,94,0.85)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            color: "white", fontFamily: "Arial, sans-serif", zIndex: 1000,
          }}>
            <div style={{ fontSize: 36 }}>🏗️</div>
            <div style={{ fontWeight: "bold", marginTop: 10 }}>
              Generating your plan...
            </div>
            <div style={{ fontSize: 12, marginTop: 6, color: "#AED6F1" }}>
              This can take a few seconds
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Full screen map ───────────────────────────────────────────────────────
  if (mapCoords) {
    return (
      <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
        <MapPicker
          initialLat={mapCoords.lat}
          initialLng={mapCoords.lng}
          onLocationConfirmed={handleConfirmed}
          onBack={() => setMapCoords(null)}
        />
      </div>
    );
  }

  // ── Main screen ───────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight:     "100vh",
      background:    "#F4F6F9",
      display:       "flex",
      flexDirection: "column",
      alignItems:    "center",
      padding:       "24px 16px",
      fontFamily:    "Arial, sans-serif",
    }}>

      {/* Header */}
      <div style={{
        background:   "#1A3C5E",
        borderRadius: 16,
        padding:      "28px 32px",
        width:        "100%",
        maxWidth:     480,
        marginBottom: 20,
        textAlign:    "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏗️</div>
        <h1 style={{ color: "white", margin: 0, fontSize: 20 }}>
          AI Architecture Planning
        </h1>
        <p style={{ color: "#AED6F1", margin: "8px 0 0", fontSize: 13 }}>
          Jaffna District, Sri Lanka
        </p>
      </div>

      {/* GPS loading */}
      {gpsLoading && (
        <div style={{
          background:   "white",
          borderRadius: 16,
          padding:      24,
          width:        "100%",
          maxWidth:     480,
          textAlign:    "center",
          boxShadow:    "0 4px 20px rgba(0,0,0,0.08)",
          marginBottom: 20,
        }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📡</div>
          <div style={{ color: "#1A3C5E", fontWeight: "bold", fontSize: 14 }}>
            Detecting your location...
          </div>
          <div style={{ color: "#888", fontSize: 12, marginTop: 6 }}>
            Please allow location access when prompted
          </div>
        </div>
      )}

      {/* Search card */}
      {!gpsLoading && (
        <div style={{
          background:   "white",
          borderRadius: 16,
          padding:      24,
          width:        "100%",
          maxWidth:     480,
          boxShadow:    "0 4px 20px rgba(0,0,0,0.08)",
          marginBottom: 20,
        }}>
          {/* GPS button */}
          <button
            onClick={detectGPS}
            style={{
              width:        "100%",
              padding:      "12px 0",
              background:   "#F0A500",
              color:        "white",
              border:       "none",
              borderRadius: 10,
              fontSize:     14,
              fontWeight:   "bold",
              cursor:       "pointer",
              marginBottom: 16,
            }}
          >
            📡 Use My Current Location
          </button>

          <div style={{
            textAlign:    "center",
            color:        "#AAA",
            fontSize:     12,
            marginBottom: 14,
          }}>
            — or type address manually —
          </div>

          <label style={{ fontWeight: "bold", color: "#1A3C5E", fontSize: 14 }}>
            📍 Enter Your Land Address
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. Punitha Anthoniyar Road, Chunnakam"
            style={{
              width:        "100%",
              marginTop:    10,
              padding:      "12px 14px",
              border:       "1.5px solid #D6EAF8",
              borderRadius: 10,
              fontSize:     14,
              outline:      "none",
              boxSizing:    "border-box",
              color:        "#1C2833",
            }}
          />

          {error && (
            <div style={{
              color:      "#C0392B",
              fontSize:   12,
              marginTop:  8,
              background: "#FDEDEC",
              padding:    "8px 12px",
              borderRadius: 8,
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              width:        "100%",
              marginTop:    16,
              padding:      "13px 0",
              background:   loading ? "#AEB6BF" : "#1A3C5E",
              color:        "white",
              border:       "none",
              borderRadius: 10,
              fontSize:     14,
              fontWeight:   "bold",
              cursor:       loading ? "not-allowed" : "pointer",
            }}
          >
              {loading ? "Searching..." : "🔍 Find on Map"}
          </button>

          {/* NEW BUTTON: paste here */}
          <button
            onClick={() => setMapCoords(JAFFNA_CENTER)}
            style={{
              width:        "100%",
              marginTop:    10,
              padding:      "12px 0",
              background:   "white",
              color:        "#1A3C5E",
              border:       "1.5px solid #1A3C5E",
              borderRadius: 10,
              fontSize:     14,
              fontWeight:   "bold",
              cursor:       "pointer",
            }}
          >
            🗺️ Open Map at Jaffna
          </button>
        </div>
      )}

      {/* Confirmed result */}
      {confirmed && (
        <div style={{
          background:   "white",
          borderRadius: 16,
          padding:      24,
          width:        "100%",
          maxWidth:     480,
          boxShadow:    "0 4px 20px rgba(0,0,0,0.08)",
          borderLeft:   "5px solid #1E8449",
          marginBottom: 20,
        }}>
          <div style={{ fontWeight: "bold", color: "#1E8449", marginBottom: 8 }}>
            ✅ Location Confirmed
          </div>
          <div style={{ fontSize: 13, color: "#333", lineHeight: 1.5 }}>
            {confirmed.address}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
            Lat: {confirmed.lat.toFixed(6)} | Lng: {confirmed.lng.toFixed(6)}
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              marginTop:    14,
              padding:      "10px 20px",
              background:   "#F0A500",
              color:        "white",
              border:       "none",
              borderRadius: 8,
              fontWeight:   "bold",
              cursor:       "pointer",
              fontSize:     13,
            }}
          >
            Continue → Fill Land Details
          </button>
        </div>
      )}

      {/* Search History */}
      {history.length > 0 && (
        <div style={{
          background:   "white",
          borderRadius: 16,
          padding:      20,
          width:        "100%",
          maxWidth:     480,
          boxShadow:    "0 4px 20px rgba(0,0,0,0.08)",
        }}>
          <div style={{
            display:        "flex",
            justifyContent: "space-between",
            alignItems:     "center",
            marginBottom:   14,
          }}>
            <span style={{ fontWeight: "bold", color: "#1A3C5E", fontSize: 14 }}>
              🕐 Recent Locations
            </span>
            <button
              onClick={clearHistory}
              style={{
                background: "none",
                border:     "none",
                color:      "#E74C3C",
                fontSize:   12,
                cursor:     "pointer",
                fontWeight: "bold",
              }}
            >
              Clear All
            </button>
          </div>

          {history.map((item, index) => (
            <div
              key={index}
              onClick={() => handleHistoryTap(item)}
              style={{
                display:      "flex",
                alignItems:   "center",
                padding:      "10px 12px",
                borderRadius: 10,
                cursor:       "pointer",
                marginBottom: index < history.length - 1 ? 8 : 0,
                background:   "#F4F6F9",
                transition:   "background 0.2s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#D6EAF8"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#F4F6F9"}
            >
              <div style={{ fontSize: 18, marginRight: 12, flexShrink: 0 }}>
                📍
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{
                  fontSize:     12,
                  color:        "#1A3C5E",
                  fontWeight:   "bold",
                  whiteSpace:   "nowrap",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {item.address}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                  {item.savedAt ? `  ·  ${formatDate(item.savedAt)}` : ""}
                </div>
              </div>
              <div style={{ color: "#1A3C5E", fontSize: 16, marginLeft: 8, flexShrink: 0 }}>
                →
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default Home;