// src/pages/LandDetailsForm.jsx
import React, { useState } from "react";

const LAND_SHAPES = [
  "Rectangular", "Square", "L-Shape", "Corner Plot", "Irregular"
];

const ROAD_TYPES = [
  { label: "Highway (A-Road)",   value: 12.0 },
  { label: "Main Road (B-Road)", value: 9.0  },
  { label: "Local Road",         value: 6.0  },
  { label: "Lane / Small Road",  value: 3.0  },
];

const BUILDING_PURPOSES = [
  "House", "Apartment", "Office", "Shop", "Supermarket",
  "Hospital", "School", "Hotel", "Warehouse", "Mixed-Use"
];

// Default room template per floor
const defaultFloorRooms = () => ({
  bedrooms:       0,
  bathrooms:      0,
  kitchens:       0,
  visitorHalls:   0,
  extraRooms:     0,
  extraRoomNote:  "",
});

// ── Step indicator ────────────────────────────────────────────────────────────
const StepIndicator = ({ current, total }) => (
  <div style={{
    display:        "flex",
    justifyContent: "center",
    alignItems:     "center",
    gap:            8,
    marginBottom:   20,
  }}>
    {Array.from({ length: total }).map((_, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center" }}>
        <div style={{
          width:          32,
          height:         32,
          borderRadius:   "50%",
          background:     i < current ? "#1E8449"
                        : i === current ? "#1A3C5E"
                        : "#D6EAF8",
          color:          i <= current ? "white" : "#888",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          fontWeight:     "bold",
          fontSize:       13,
          fontFamily:     "Arial, sans-serif",
        }}>
          {i < current ? "✓" : i + 1}
        </div>
        {i < total - 1 && (
          <div style={{
            width:      24,
            height:     2,
            background: i < current ? "#1E8449" : "#D6EAF8",
            margin:     "0 4px",
          }} />
        )}
      </div>
    ))}
  </div>
);

// ── Field wrapper ─────────────────────────────────────────────────────────────
const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom: 18 }}>
    <label style={{
      fontWeight:   "bold",
      color:        "#1A3C5E",
      fontSize:     13,
      display:      "block",
      marginBottom: 6,
      fontFamily:   "Arial, sans-serif",
    }}>
      {label}
    </label>
    {children}
    {hint && (
      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{hint}</div>
    )}
  </div>
);

const inputStyle = {
  width:        "100%",
  padding:      "11px 14px",
  border:       "1.5px solid #D6EAF8",
  borderRadius: 10,
  fontSize:     14,
  outline:      "none",
  boxSizing:    "border-box",
  color:        "#1C2833",
  fontFamily:   "Arial, sans-serif",
};

const selectStyle = { ...inputStyle, background: "white", cursor: "pointer" };

// ── Unit toggle ───────────────────────────────────────────────────────────────
const UnitToggle = ({ unit, onChange }) => (
  <div style={{
    display:      "flex",
    background:   "#F4F6F9",
    borderRadius: 8,
    padding:      3,
    marginBottom: 16,
    width:        "fit-content",
  }}>
    {["m", "ft"].map((u) => (
      <button key={u} onClick={() => onChange(u)} style={{
        padding:      "6px 20px",
        border:       "none",
        borderRadius: 6,
        background:   unit === u ? "#1A3C5E" : "transparent",
        color:        unit === u ? "white" : "#888",
        fontWeight:   "bold",
        fontSize:     13,
        cursor:       "pointer",
        fontFamily:   "Arial, sans-serif",
        transition:   "all 0.2s",
      }}>{u}</button>
    ))}
  </div>
);

// ── Counter ───────────────────────────────────────────────────────────────────
const Counter = ({ value, onChange, min = 0, max = 20 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
    <button
      onClick={() => onChange(Math.max(min, value - 1))}
      style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "2px solid #D6EAF8", background: "white",
        fontSize: 20, cursor: "pointer", color: "#1A3C5E",
        fontWeight: "bold", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
    >−</button>
    <span style={{
      fontSize: 18, fontWeight: "bold",
      color: "#1A3C5E", minWidth: 28, textAlign: "center",
    }}>{value}</span>
    <button
      onClick={() => onChange(Math.min(max, value + 1))}
      style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "none", background: "#1A3C5E",
        fontSize: 20, cursor: "pointer", color: "white",
        fontWeight: "bold", display: "flex",
        alignItems: "center", justifyContent: "center",
      }}
    >+</button>
  </div>
);

// ── Per-floor room configurator ───────────────────────────────────────────────
const FloorConfig = ({ label, rooms, onChange, purpose }) => {
  const update = (key, val) => onChange({ ...rooms, [key]: val });

  const showBeds    = ["House","Apartment","Hotel"].includes(purpose);
  const showKitchen = ["House","Apartment","Hotel"].includes(purpose);

  return (
    <div style={{
      background:   "#F4F6F9",
      borderRadius: 12,
      padding:      16,
      marginBottom: 14,
      border:       "1.5px solid #D6EAF8",
    }}>
      <div style={{
        background:   "#1A3C5E",
        color:        "white",
        borderRadius: 8,
        padding:      "6px 14px",
        fontWeight:   "bold",
        fontSize:     13,
        marginBottom: 14,
        display:      "inline-block",
        fontFamily:   "Arial, sans-serif",
      }}>
        {label}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {showBeds && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#1A3C5E", fontFamily: "Arial" }}>🛏️ Bedrooms</span>
            <Counter value={rooms.bedrooms} onChange={(v) => update("bedrooms", v)} />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#1A3C5E", fontFamily: "Arial" }}>🚿 Bathrooms</span>
          <Counter value={rooms.bathrooms} onChange={(v) => update("bathrooms", v)} />
        </div>

        {showKitchen && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#1A3C5E", fontFamily: "Arial" }}>🍳 Kitchens</span>
            <Counter value={rooms.kitchens} onChange={(v) => update("kitchens", v)} />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#1A3C5E", fontFamily: "Arial" }}>🛋️ Visitor's Halls</span>
          <Counter value={rooms.visitorHalls} onChange={(v) => update("visitorHalls", v)} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#1A3C5E", fontFamily: "Arial" }}>🚪 Extra Rooms</span>
          <Counter value={rooms.extraRooms} onChange={(v) => update("extraRooms", v)} />
        </div>

        {rooms.extraRooms > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4, fontFamily: "Arial" }}>
              Describe extra rooms (optional)
            </div>
            <input
              type="text"
              value={rooms.extraRoomNote}
              onChange={(e) => update("extraRoomNote", e.target.value)}
              placeholder={`e.g. storage room, prayer room, study room`}
              style={{
                ...inputStyle,
                fontSize:  12,
                padding:   "8px 12px",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ── Floor chip picker (for "Almost" mode) ─────────────────────────────────────
const FloorChipPicker = ({ floors, selected, onToggle }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
    {Array.from({ length: floors }).map((_, i) => {
      const floorNum = i + 1;
      const isOn = selected.includes(floorNum);
      const label = floorNum === 1 ? "Ground" : `Floor ${floorNum}`;
      return (
        <button
          key={floorNum}
          onClick={() => onToggle(floorNum)}
          style={{
            padding:      "6px 14px",
            borderRadius: 8,
            border:       "2px solid",
            borderColor:  isOn ? "#F0A500" : "#D6EAF8",
            background:   isOn ? "#F0A500" : "white",
            color:        isOn ? "white" : "#888",
            fontWeight:   "bold",
            fontSize:     12,
            cursor:       "pointer",
            fontFamily:   "Arial, sans-serif",
          }}
        >
          {label}
        </button>
      );
    })}
  </div>
);

// ── Apply-to-all button (shared by custom mode) ───────────────────────────────
const ApplyToAllButton = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      width:        "100%",
      padding:      "10px 0",
      background:   "white",
      color:        "#1A3C5E",
      border:       "2px solid #1A3C5E",
      borderRadius: 10,
      fontWeight:   "bold",
      fontSize:     13,
      cursor:       "pointer",
      fontFamily:   "Arial, sans-serif",
      marginBottom: 16,
    }}
  >
    ⬇️ Apply Standard Floor to All Floors
  </button>
);

// ── Main component ────────────────────────────────────────────────────────────
const LandDetailsForm = ({ location, onSubmit, onBack }) => {
  const [step, setStep]     = useState(0);
  const [unit, setUnit]     = useState("m");
  const [errors, setErrors] = useState({});

  // Step 1 — Land
  const [landLength, setLandLength] = useState("");
  const [landWidth,  setLandWidth]  = useState("");
  const [roadFrontage, setRoadFrontage] = useState("");
  const [landShape,  setLandShape]  = useState("Rectangular");
  const [roadType,   setRoadType]   = useState(ROAD_TYPES[2]);

  // Step 2 — Building
  const [purpose, setPurpose] = useState("House");
  const [floors,  setFloors]  = useState(1);

  // layoutMode: "same" | "almost" | "custom"
  const [layoutMode, setLayoutMode] = useState("same");

  // Used by "same", as the base default in "almost", AND as the fill
  // template in "custom" — one config, reused everywhere it's needed.
  const [standardRooms, setStandardRooms] = useState(defaultFloorRooms());

  // "Almost" mode — which floor numbers deviate from standard, and their overrides
  const [differentFloors, setDifferentFloors] = useState([]); // e.g. [10]
  const [floorOverrides,  setFloorOverrides]  = useState({}); // { 10: {...rooms} }

  // "Custom" mode — every floor configured independently
  const [floorRooms, setFloorRooms] = useState([{ ...defaultFloorRooms() }]);

  // Free text notes → goes to Gemini, never to the ML model
  const [description, setDescription] = useState("");

  // ── Floor count sync ───────────────────────────────────────────────────────
  const handleFloorsChange = (val) => {
    setFloors(val);

    // Keep "custom" array in sync. New floors pre-fill from the standard
    // template instead of blank zeros — one less thing to re-type.
    setFloorRooms((prev) => {
      if (val > prev.length) {
        return [
          ...prev,
          ...Array(val - prev.length).fill(null).map(() => ({ ...standardRooms })),
        ];
      }
      return prev.slice(0, val);
    });

    // drop any "different floor" flags/overrides beyond the new floor count
    setDifferentFloors((prev) => prev.filter((f) => f <= val));
    setFloorOverrides((prev) => {
      const trimmed = {};
      Object.entries(prev).forEach(([k, v]) => {
        if (Number(k) <= val) trimmed[k] = v;
      });
      return trimmed;
    });
  };

  const updateFloorRoom = (floorIndex, rooms) => {
    setFloorRooms((prev) => {
      const updated = [...prev];
      updated[floorIndex] = rooms;
      return updated;
    });
  };

  // "Apply Standard Floor to All Floors" — overwrites every floor in
  // custom mode with a fresh copy of the current standard config.
  const applyStandardToAllFloors = () => {
    setFloorRooms(Array(floors).fill(null).map(() => ({ ...standardRooms })));
  };

  const toggleDifferentFloor = (floorNum) => {
    setDifferentFloors((prev) => {
      if (prev.includes(floorNum)) {
        setFloorOverrides((o) => {
          const next = { ...o };
          delete next[floorNum];
          return next;
        });
        return prev.filter((f) => f !== floorNum);
      } else {
        // Start from a COPY of the standard floor, not a blank template —
        // so marking a floor "different" doesn't wipe out everything that's
        // actually the same. The user only needs to touch what changed.
        setFloorOverrides((o) => ({ ...o, [floorNum]: { ...standardRooms } }));
        return [...prev, floorNum].sort((a, b) => a - b);
      }
    });
  };

  const updateFloorOverride = (floorNum, rooms) => {
    setFloorOverrides((prev) => ({ ...prev, [floorNum]: rooms }));
  };

  // ── Unit conversion ───────────────────────────────────────────────────────
  const toMetres = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return 0;
    return unit === "ft" ? n * 0.3048 : n;
  };

  const landLengthM = toMetres(landLength);
  const landWidthM  = toMetres(landWidth);
  const roadFrontageM = toMetres(roadFrontage);
  const areaSqm     = landLengthM * landWidthM;
  const areaPerch   = areaSqm / 25.29;

  // ── Validation ────────────────────────────────────────────────────────────
  const validateStep1 = () => {
    const e = {};
    if (!landLength || parseFloat(landLength) <= 0)
      e.landLength = "Please enter a valid length";
    if (!landWidth || parseFloat(landWidth) <= 0)
      e.landWidth = "Please enter a valid width";
    if (landLengthM > 0 && landWidthM > 0 && areaSqm < 50)
      e.area = "Land area seems too small (minimum ~50 sqm)";
    if (roadFrontage !== "") {
  if (parseFloat(roadFrontage) <= 0)
    e.roadFrontage = "Frontage must be more than 0";
  else if (roadFrontageM > Math.max(landLengthM, landWidthM))
    e.roadFrontage = "Frontage cannot be longer than the plot's longest side";
}
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep1()) return;
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step === 0) onBack();
    else setStep(step - 1);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    let rooms;
    if (floors === 1 || layoutMode === "same") {
      rooms = { type: "same", data: standardRooms };
    } else if (layoutMode === "almost") {
      rooms = {
        type:      "standardWithOverrides",
        standard:  standardRooms,
        overrides: floorOverrides, // { floorNum: rooms }
      };
    } else {
      rooms = { type: "perFloor", data: floorRooms };
    }

    onSubmit({
      lat:           location.lat,
      lng:           location.lng,
      address:       location.address,
      landLength:    landLengthM,
      landWidth:     landWidthM,
      roadFrontage:  roadFrontage === "" ? null : roadFrontageM,
      landAreaSqm:   areaSqm,
      landAreaPerch: areaPerch,
      landShape,
      roadWidth:     roadType.value,
      roadLabel:     roadType.label,
      purpose,
      floors,
      layoutMode: floors === 1 ? "same" : layoutMode,
      rooms,
      roadFrontage: roadFrontage || null,
      notes: description.trim(),
    });
  };

  const card = {
    background:   "white",
    borderRadius: 16,
    padding:      24,
    width:        "100%",
    maxWidth:     480,
    boxShadow:    "0 4px 20px rgba(0,0,0,0.08)",
    fontFamily:   "Arial, sans-serif",
  };

  const stepTitles = [
    "🏞️ Land Information",
    "🏠 Building Requirements",
    "📋 Review & Confirm",
  ];

  const ReviewRow = ({ label, value }) => (
    <div style={{
      display:        "flex",
      justifyContent: "space-between",
      padding:        "5px 0",
      fontSize:       12,
    }}>
      <span style={{ color: "#888" }}>{label}</span>
      <span style={{ color: "#1A3C5E", fontWeight: "bold" }}>{value}</span>
    </div>
  );

  const SectionTitle = ({ children }) => (
    <div style={{
      fontWeight:    "bold",
      color:         "#1A3C5E",
      fontSize:      13,
      marginBottom:  10,
      marginTop:     16,
      paddingBottom: 6,
      borderBottom:  "2px solid #D6EAF8",
    }}>
      {children}
    </div>
  );

  const roomSummary = (rooms) => ({
    "Bedrooms":        rooms.bedrooms,
    "Bathrooms":       rooms.bathrooms,
    "Kitchens":        rooms.kitchens,
    "Visitor's Halls": rooms.visitorHalls,
    "Extra Rooms":     rooms.extraRooms,
  });

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
        padding:      "20px 24px",
        width:        "100%",
        maxWidth:     480,
        marginBottom: 20,
        display:      "flex",
        alignItems:   "center",
        gap:          12,
      }}>
        <button onClick={handleBack} style={{
          background:   "rgba(255,255,255,0.15)",
          border:       "none",
          borderRadius: 8,
          color:        "white",
          padding:      "6px 12px",
          cursor:       "pointer",
          fontSize:     13,
          fontWeight:   "bold",
        }}>← Back</button>
        <div>
          <div style={{ color: "white", fontWeight: "bold", fontSize: 15 }}>
            {stepTitles[step]}
          </div>
          <div style={{ color: "#AED6F1", fontSize: 11, marginTop: 2 }}>
            {location.address.substring(0, 50)}...
          </div>
        </div>
      </div>

      <StepIndicator current={step} total={3} />

      {/* ── STEP 1: Land Information ── */}
      {step === 0 && (
        <div style={card}>
          <UnitToggle unit={unit} onChange={setUnit} />

          <Field label={`Land Length (${unit})`} hint="Measure along the road-facing side">
            <input
              type="number"
              value={landLength}
              onChange={(e) => setLandLength(e.target.value)}
              placeholder={unit === "m" ? "e.g. 20" : "e.g. 65"}
              style={{ ...inputStyle, borderColor: errors.landLength ? "#E74C3C" : "#D6EAF8" }}
            />
            {errors.landLength && (
              <div style={{ color: "#E74C3C", fontSize: 11, marginTop: 4 }}>
                {errors.landLength}
              </div>
            )}
          </Field>

          <Field label={`Land Width (${unit})`}>
            <input
              type="number"
              value={landWidth}
              onChange={(e) => setLandWidth(e.target.value)}
              placeholder={unit === "m" ? "e.g. 15" : "e.g. 49"}
              style={{ ...inputStyle, borderColor: errors.landWidth ? "#E74C3C" : "#D6EAF8" }}
            />
            {errors.landWidth && (
              <div style={{ color: "#E74C3C", fontSize: 11, marginTop: 4 }}>
                {errors.landWidth}
              </div>
            )}
          </Field>

          {areaSqm > 0 && (
            <div style={{
              background:     "#EBF5FB",
              borderRadius:   10,
              padding:        "12px 16px",
              marginBottom:   18,
              display:        "flex",
              justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 11, color: "#888" }}>Land Area</div>
                <div style={{ fontWeight: "bold", color: "#1A3C5E", fontSize: 15 }}>
                  {areaSqm.toFixed(1)} sqm
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#888" }}>In Perches</div>
                <div style={{ fontWeight: "bold", color: "#1A3C5E", fontSize: 15 }}>
                  {areaPerch.toFixed(2)} perch
                </div>
              </div>
            </div>
          )}

          {errors.area && (
            <div style={{
              color: "#E74C3C", fontSize: 12,
              background: "#FDEDEC", padding: "8px 12px",
              borderRadius: 8, marginBottom: 12,
            }}>⚠️ {errors.area}</div>
          )}

          <Field label="Land Shape">
            <select value={landShape} onChange={(e) => setLandShape(e.target.value)} style={selectStyle}>
              {LAND_SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          <Field label="Road Type" hint="Select the type of road your land faces">
            <select
              value={roadType.label}
              onChange={(e) => {
                const found = ROAD_TYPES.find(r => r.label === e.target.value);
                if (found) setRoadType(found);
              }}
              style={selectStyle}
            >
              {ROAD_TYPES.map((r) => (
                <option key={r.label} value={r.label}>
                  {r.label} (~{r.value}m wide)
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {/* ── STEP 2: Building Requirements ── */}
      {step === 1 && (
        <div style={card}>
          <Field label="Building Purpose">
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={selectStyle}>
              {BUILDING_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>

          <Field label="Number of Floors">
            <Counter value={floors} onChange={handleFloorsChange} min={1} max={15} />
          </Field>

          {floors > 1 && (
            <Field label="Same layout on all floors?">
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { key: "same",   label: "Yes" },
                  { key: "almost", label: "Almost" },
                  { key: "custom", label: "No" },
                ].map((opt) => (
                  <button key={opt.key} onClick={() => setLayoutMode(opt.key)} style={{
                    flex:         1,
                    padding:      "10px 0",
                    border:       "2px solid",
                    borderColor:  layoutMode === opt.key ? "#1A3C5E" : "#D6EAF8",
                    borderRadius: 10,
                    background:   layoutMode === opt.key ? "#1A3C5E" : "white",
                    color:        layoutMode === opt.key ? "white" : "#888",
                    fontWeight:   "bold",
                    cursor:       "pointer",
                    fontSize:     13,
                  }}>{opt.label}</button>
                ))}
              </div>
            </Field>
          )}

          {/* "Yes" — one config applied to all floors */}
          {(floors === 1 || layoutMode === "same") && (
            <div style={{
              background:   "#F4F6F9",
              borderRadius: 12,
              padding:      16,
              border:       "1.5px solid #D6EAF8",
            }}>
              <div style={{
                fontSize: 12, color: "#888",
                marginBottom: 12, fontFamily: "Arial",
              }}>
                {floors === 1 ? "Room configuration" : "Applied to all floors"}
              </div>
              <FloorConfig
                label={floors === 1 ? "Ground Floor" : "Standard Floor"}
                rooms={standardRooms}
                onChange={setStandardRooms}
                purpose={purpose}
              />
            </div>
          )}

          {/* "Almost" — standard floor + pick which floors differ */}
          {floors > 1 && layoutMode === "almost" && (
            <div>
              <div style={{
                fontSize: 12, color: "#888",
                marginBottom: 12, fontFamily: "Arial",
              }}>
                Configure the standard floor (default for all floors):
              </div>
              <FloorConfig
                label="Standard Floor"
                rooms={standardRooms}
                onChange={setStandardRooms}
                purpose={purpose}
              />

              <div style={{
                fontSize: 12, color: "#888",
                margin: "16px 0 10px", fontFamily: "Arial",
              }}>
                Tap any floor that's different from the standard:
              </div>
              <FloorChipPicker
                floors={floors}
                selected={differentFloors}
                onToggle={toggleDifferentFloor}
              />

              {differentFloors.map((floorNum) => (
                <div key={floorNum} style={{ marginTop: 14 }}>
                  <FloorConfig
                    label={floorNum === 1 ? "Ground Floor (different)" : `Floor ${floorNum} (different)`}
                    rooms={floorOverrides[floorNum] || { ...standardRooms }}
                    onChange={(updated) => updateFloorOverride(floorNum, updated)}
                    purpose={purpose}
                  />
                </div>
              ))}
            </div>
          )}

          {/* "No" — standard template + apply-to-all, then per-floor tweaks */}
          {floors > 1 && layoutMode === "custom" && (
            <div>
              <div style={{
                fontSize: 12, color: "#888",
                marginBottom: 12, fontFamily: "Arial",
              }}>
                Set a starting point, apply it to every floor, then adjust any floor that's different:
              </div>

              <FloorConfig
                label="Standard Floor (template)"
                rooms={standardRooms}
                onChange={setStandardRooms}
                purpose={purpose}
              />

              <ApplyToAllButton onClick={applyStandardToAllFloors} />

              <div style={{
                fontSize: 12, color: "#888",
                marginBottom: 12, fontFamily: "Arial",
              }}>
                Individual floors (edit any that differ):
              </div>
              {floorRooms.map((rooms, i) => (
                <FloorConfig
                  key={i}
                  label={i === 0 ? "Ground Floor" : `Floor ${i + 1}`}
                  rooms={rooms}
                  onChange={(updated) => updateFloorRoom(i, updated)}
                  purpose={purpose}
                />
              ))}
            </div>
          )}

          {/* Free text — goes to Gemini only, never to the ML model */}
          <Field
            label="Additional Notes (optional)"
            hint="Describe anything the numbers above don't capture — this is used only for the written explanation, not the ML prediction"
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Rooftop floor has a terrace garden and a small gym"
              rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "Arial, sans-serif" }}
            />
          </Field>

          <Field
            label={`Road Frontage (${unit}) - optional`}
            hint="Length of the plot side that touches the road. Leave empty if unsure."
        >
          <input
            type="number"
            value={roadFrontage}
            onChange={(e) => setRoadFrontage(e.target.value)}
            placeholder={unit === "m" ? "e.g. 12" : "e.g. 40"}
            style={{ ...inputStyle, borderColor: errors.roadFrontage ? "#E74C3C" : "#D6EAF8" }}
          />
          {errors.roadFrontage && (
            <div style={{ color: "#E74C3C", fontSize: 11, marginTop: 4 }}>
              {errors.roadFrontage}
            </div>
          )}
        </Field>
        </div>
      )}

      {/* ── STEP 3: Review ── */}
      {step === 2 && (
        <div style={card}>
          <SectionTitle>📍 Location</SectionTitle>
          <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>
            {location.address}
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </div>

          <SectionTitle>🏞️ Land Details</SectionTitle>
          <ReviewRow label="Length"    value={`${landLengthM.toFixed(2)}m`} />
          <ReviewRow label="Width"     value={`${landWidthM.toFixed(2)}m`} />
            {roadFrontage !== "" && 
            (
              <ReviewRow label="Road Frontage" value={`${roadFrontageM.toFixed(2)}m`} />
            )}
          <ReviewRow label="Area"      value={`${areaSqm.toFixed(1)} sqm / ${areaPerch.toFixed(2)} perch`} />
          <ReviewRow label="Shape"     value={landShape} />
          <ReviewRow label="Road Type" value={`${roadType.label} (~${roadType.value}m)`} />

          <SectionTitle>🏠 Building</SectionTitle>
          <ReviewRow label="Purpose" value={purpose} />
          <ReviewRow label="Floors"  value={floors} />
          <ReviewRow
            label="Layout"
            value={
              floors === 1 ? "Single floor"
              : layoutMode === "same"   ? "Same on all floors"
              : layoutMode === "almost" ? `Standard + ${differentFloors.length} different`
              : "Different per floor"
            }
          />

          {(floors === 1 || layoutMode === "same") && (
            <div style={{ background: "#F4F6F9", borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
                Room Configuration (all floors)
              </div>
              {Object.entries(roomSummary(standardRooms)).map(([k, v]) => (
                <ReviewRow key={k} label={k} value={v} />
              ))}
              {standardRooms.extraRoomNote && (
                <ReviewRow label="Extra Room Notes" value={standardRooms.extraRoomNote} />
              )}
            </div>
          )}

          {layoutMode === "almost" && floors > 1 && (
            <>
              <div style={{ background: "#F4F6F9", borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
                  Standard Floor (applies unless overridden)
                </div>
                {Object.entries(roomSummary(standardRooms)).map(([k, v]) => (
                  <ReviewRow key={k} label={k} value={v} />
                ))}
              </div>
              {differentFloors.map((floorNum) => (
                <div key={floorNum} style={{ background: "#F4F6F9", borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: "#1A3C5E", marginBottom: 6 }}>
                    {floorNum === 1 ? "Ground Floor" : `Floor ${floorNum}`} (different)
                  </div>
                  {Object.entries(roomSummary(floorOverrides[floorNum] || { ...standardRooms })).map(([k, v]) => (
                    <ReviewRow key={k} label={k} value={v} />
                  ))}
                </div>
              ))}
            </>
          )}

          {layoutMode === "custom" && floors > 1 && floorRooms.map((rooms, i) => (
            <div key={i} style={{ background: "#F4F6F9", borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: "bold", color: "#1A3C5E", marginBottom: 6 }}>
                {i === 0 ? "Ground Floor" : `Floor ${i + 1}`}
              </div>
              {Object.entries(roomSummary(rooms)).map(([k, v]) => (
                <ReviewRow key={k} label={k} value={v} />
              ))}
              {rooms.extraRoomNote && (
                <ReviewRow label="Extra Room Notes" value={rooms.extraRoomNote} />
              )}
            </div>
          ))}

          {description.trim() && (
            <>
              <SectionTitle>📝 Additional Notes</SectionTitle>
              <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6, fontStyle: "italic" }}>
                "{description.trim()}"
              </div>
              <div style={{ fontSize: 10, color: "#AAA", marginTop: 4 }}>
                Used for the written explanation only — not sent to the ML model.
              </div>
            </>
          )}

          <button onClick={handleSubmit} style={{
            width:        "100%",
            padding:      "14px 0",
            background:   "#1E8449",
            color:        "white",
            border:       "none",
            borderRadius: 10,
            fontSize:     15,
            fontWeight:   "bold",
            cursor:       "pointer",
            marginTop:    20,
            boxShadow:    "0 4px 12px rgba(30,132,73,0.4)",
          }}>
            🏗️ Generate My Building Plan
          </button>

          <div style={{
            fontSize:   10,
            color:      "#AAA",
            textAlign:  "center",
            marginTop:  10,
            lineHeight: 1.5,
          }}>
            AI-generated concept plan only. A licensed architect
            must certify the final construction drawings.
          </div>
        </div>
      )}

      {/* Next button */}
      {step < 2 && (
        <div style={{ width: "100%", maxWidth: 480, marginTop: 16 }}>
          <button onClick={handleNext} style={{
            width:        "100%",
            padding:      "14px 0",
            background:   "#1A3C5E",
            color:        "white",
            border:       "none",
            borderRadius: 10,
            fontSize:     15,
            fontWeight:   "bold",
            cursor:       "pointer",
            boxShadow:    "0 4px 12px rgba(26,60,94,0.3)",
          }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default LandDetailsForm;