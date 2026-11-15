// src/components/BlueprintSection.jsx
// Floor plans + "change something" box + Regenerate + previous/next version
import React, { useState, useEffect } from "react";
import { blueprintUrl, editBlueprint } from "../services/api";

const card = {
  background:   "white",
  borderRadius: 16,
  padding:      24,
  width:        "100%",
  maxWidth:     480,
  boxShadow:    "0 4px 20px rgba(0,0,0,0.08)",
  marginBottom: 16,
  boxSizing:    "border-box",
  fontFamily:   "Arial, sans-serif",
};

const Title = ({ children }) => (
  <div style={{
    fontWeight: "bold", color: "#1A3C5E", fontSize: 14,
    marginBottom: 10, paddingBottom: 6, borderBottom: "2px solid #D6EAF8",
  }}>
    {children}
  </div>
);

const navButton = (disabled) => ({
  flex: 1, padding: "9px 0", background: "white",
  color: disabled ? "#AEB6BF" : "#1A3C5E",
  border: `2px solid ${disabled ? "#D6EAF8" : "#1A3C5E"}`,
  borderRadius: 8, fontWeight: "bold", fontSize: 12,
  cursor: disabled ? "not-allowed" : "pointer",
});

const BlueprintSection = ({ result, inputs, onActiveChange }) => {
  const [versions, setVersions] = useState([{
    label:      "Original plan",
    summary:    "",
    variant:    0,
    extraDoors: [],
    blueprints: result.blueprints || {},
    breakdown:  result.per_floor_breakdown || [],
  }]);
  const [active, setActive]   = useState(0);
  const [text, setText]       = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice]   = useState(null); // { type: "error" | "info", text }

  const current  = versions[active];
  const canEdit  = Boolean(inputs) && current.breakdown.length > 0;
  const planList = Object.entries(current.blueprints || {})
    .sort((a, b) => Number(a[0]) - Number(b[0]));

  // Tell the results page which plan is on screen (used by the PDF button)
  useEffect(() => {
    if (onActiveChange) onActiveChange(current.blueprints, current.breakdown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, versions]);

  const handleRegenerate = async () => {
    if (!text.trim()) {
      setNotice({ type: "error", text: "Please type what you want to change." });
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      const res = await editBlueprint({
        instruction:        text.trim(),
        perFloorBreakdown:  current.breakdown,
        purpose:            inputs.purpose,
        layout_type:        result.layout_type,
        structure_type:     result.structure_type,
        landLength:         inputs.landLength,
        landWidth:          inputs.landWidth,
        groundFloorAreaSqm: result.ground_floor_area_sqm,
        roadLabel:          inputs.roadLabel,
        variant:            current.variant,
        extraDoors:         current.extraDoors,
        extraRoads:         inputs.extraRoads || [],
      });
      if (res.applied) {
        const next = {
          label:      `Edit ${versions.length}`,
          summary:    res.summary || text.trim(),
          variant:    typeof res.variant === "number" ? res.variant : current.variant,
          extraDoors: res.extraDoors || current.extraDoors,
          blueprints: res.blueprints,
          breakdown:  res.perFloorBreakdown,
        };
        setVersions([...versions, next]);
        setActive(versions.length);
        setText("");
        if (res.message) setNotice({ type: "info", text: res.message });
      } else {
        setNotice({ type: "info", text: res.message });
      }
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floor plans */}
      <div style={card}>
        <Title>🗺️ Floor Plans</Title>

        {versions.length > 1 && (
          <div style={{
            background: "#EBF5FB", borderRadius: 10, padding: "8px 12px",
            marginBottom: 12, fontSize: 12, color: "#1A3C5E",
          }}>
            <strong>Version {active + 1} of {versions.length}</strong>
            {" - "}{current.label}
            {current.summary ? `: ${current.summary}` : ""}
          </div>
        )}

        {planList.map(([floorNum, path]) => (
          <div key={`${active}-${floorNum}`} style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 12, fontWeight: "bold", color: "#1A3C5E", marginBottom: 6,
            }}>
              {floorNum === "1" ? "Ground Floor" : `Floor ${floorNum}`}
            </div>
            <img
              src={blueprintUrl(path)}
              alt={`Floor ${floorNum} plan`}
              style={{ width: "100%", borderRadius: 10, border: "1.5px solid #D6EAF8" }}
            />
          </div>
        ))}

        {versions.length > 1 && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setActive(active - 1)}
              disabled={active === 0}
              style={navButton(active === 0)}
            >
              ← Show previous blueprint
            </button>
            <button
              onClick={() => setActive(active + 1)}
              disabled={active === versions.length - 1}
              style={navButton(active === versions.length - 1)}
            >
              Show next blueprint →
            </button>
          </div>
        )}
      </div>

      {/* Change box */}
      {canEdit && (
        <div style={card}>
          <Title>✏️ Want to change something?</Title>
          <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5, marginBottom: 8 }}>
            Type what you want to change or add, then press Regenerate.
            Changes apply to the plan you are looking at.
            You can change bedrooms, bathrooms, kitchens, visitor halls and extra rooms,
            make a room bigger, smaller or square, add a door on a wall of a room,
            or ask for the rooms to be arranged in a different way.
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={3}
            disabled={loading}
            placeholder="e.g. Make the kitchen square and add a door on the south wall of Visitor's Hall 1"
            style={{
              width: "100%", padding: "11px 14px", boxSizing: "border-box",
              border: "1.5px solid #D6EAF8", borderRadius: 10, fontSize: 13,
              fontFamily: "Arial, sans-serif", color: "#1C2833",
              outline: "none", resize: "vertical",
            }}
          />

          {notice && (
            <div style={{
              marginTop: 10, padding: "8px 12px", borderRadius: 8, fontSize: 12,
              lineHeight: 1.5,
              background: notice.type === "error" ? "#FDEDEC" : "#FEF5E7",
              color:      notice.type === "error" ? "#C0392B" : "#7D5A00",
            }}>
              {notice.text}
            </div>
          )}

          <button
            onClick={handleRegenerate}
            disabled={loading}
            style={{
              width: "100%", marginTop: 12, padding: "13px 0",
              background: loading ? "#AEB6BF" : "#F0A500",
              color: "white", border: "none", borderRadius: 10,
              fontWeight: "bold", fontSize: 14,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Regenerating..." : "🔄 Regenerate Blueprint"}
          </button>

          {active > 0 && (
            <div style={{ fontSize: 11, color: "#888", marginTop: 8, lineHeight: 1.5 }}>
              Note: the feasibility result and the explanation on this page are
              for your original details.
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default BlueprintSection;