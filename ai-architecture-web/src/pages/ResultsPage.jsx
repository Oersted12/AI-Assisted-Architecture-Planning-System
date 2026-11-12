// src/pages/ResultsPage.jsx
import React, { useState } from "react";
import { downloadPdf } from "../services/api";
import BlueprintSection from "../components/BlueprintSection";

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

const Row = ({ label, value }) => (
  <div style={{
    display: "flex", justifyContent: "space-between",
    padding: "6px 0", fontSize: 13,
  }}>
    <span style={{ color: "#888" }}>{label}</span>
    <span style={{ color: "#1A3C5E", fontWeight: "bold", textAlign: "right" }}>
      {value}
    </span>
  </div>
);

const Title = ({ children }) => (
  <div style={{
    fontWeight: "bold", color: "#1A3C5E", fontSize: 14,
    marginBottom: 10, paddingBottom: 6, borderBottom: "2px solid #D6EAF8",
  }}>
    {children}
  </div>
);

// Turns **bold** text from the AI explanation into real bold text
const renderInline = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );

const ResultsPage = ({ result, inputs, address, onEdit, onNewPlan }) => {
  const [downloading, setDownloading] = useState(false);
  // The plan currently on screen (changes when the user regenerates)
  const [activeView, setActiveView] = useState({ blueprints: null, breakdown: null });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const pdfResult = {
        ...result,
        blueprints: activeView.blueprints || result.blueprints,
      };
      const pdfInputs = activeView.breakdown && activeView.breakdown.length
        ? { ...inputs, rooms: { type: "perFloor", data: activeView.breakdown } }
        : inputs;
      await downloadPdf(pdfResult, pdfInputs);
    } catch (e) {
      alert(e.message);
    } finally {
      setDownloading(false);
    }
  };

  const feasible = result.feasibility === "Feasible";
  const blueprints = Object.entries(result.blueprints || {});
  const paragraphs = (result.explanation || "")
    .split("\n\n")
    .filter((p) => p.trim());

  return (
    <div style={{
      minHeight: "100vh", background: "#F4F6F9",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "24px 16px", fontFamily: "Arial, sans-serif",
    }}>

      {/* Header */}
      <div style={{
        background: "#1A3C5E", borderRadius: 16, padding: "20px 24px",
        width: "100%", maxWidth: 480, marginBottom: 16, boxSizing: "border-box",
      }}>
        <div style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
          📊 Your Building Plan
        </div>
        {address && (
          <div style={{ color: "#AED6F1", fontSize: 11, marginTop: 4 }}>
            {address.substring(0, 60)}...
          </div>
        )}
      </div>

      {/* Yellow note: area not recognized */}
      {result.area_matched === false && (
        <div style={{
          ...card,
          background: "#FEF5E7",
          borderLeft: "5px solid #F0A500",
          padding: 16,
        }}>
          <div style={{ fontWeight: "bold", color: "#9A6700", fontSize: 13 }}>
            ⚠️ Area not recognized
          </div>
          <div style={{ fontSize: 12, color: "#7D5A00", marginTop: 4, lineHeight: 1.5 }}>
            We could not match your address to a known area, so we used
            "{result.area_name}". The result may be less exact.
          </div>
        </div>
      )}

      {/* Feasibility */}
      <div style={{
        ...card,
        borderLeft: `5px solid ${feasible ? "#1E8449" : "#C0392B"}`,
      }}>
        <div style={{
          fontWeight: "bold", fontSize: 18,
          color: feasible ? "#1E8449" : "#C0392B",
        }}>
          {feasible ? "✅ Feasible" : "❌ " + result.feasibility}
        </div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
          Confidence: {result.feas_confidence}%
        </div>
      </div>

      {/* Design summary */}
      {feasible && (
        <div style={card}>
          <Title>🏠 Suggested Design</Title>
          <Row label="Layout"
               value={`${result.layout_type} (${result.layout_confidence}%)`} />
          <Row label="Structure"
               value={`${result.structure_type} (${result.struct_confidence}%)`} />
        </div>
      )}

      {/* Zone and area numbers */}
      <div style={card}>
        <Title>📐 Zone and Area</Title>
        <Row label="Area" value={result.area_name} />
        <Row label="Zone" value={`${result.zone_name} (${result.zone_code})`} />
        <Row label="Land area" value={`${result.land_area_sqm} sqm`} />
        <Row label="Allowed floor area" value={`${result.permissible_fa_sqm} sqm`} />
        <Row label="Requested floor area" value={`${result.requested_fa_sqm} sqm`} />
        <Row label="Floor area used"
             value={`${Math.round(result.fa_utilisation_ratio * 100)}%`} />
        <Row label="Ground floor area" value={`${result.ground_floor_area_sqm} sqm`} />
      </div>

      {/* Floor plans + change box */}
      {blueprints.length > 0 && (
        <BlueprintSection
          result={result}
          inputs={inputs}
          onActiveChange={(bp, breakdown) => setActiveView({ blueprints: bp, breakdown })}
        />
      )}

      {/* AI explanation */}
      {paragraphs.length > 0 && (
        <div style={card}>
          <Title>💬 Explanation</Title>
          {paragraphs.map((p, i) => (
            <p key={i} style={{
              fontSize: 13, color: "#333", lineHeight: 1.6,
              margin: i === 0 ? "0 0 10px" : "10px 0",
            }}>
              {renderInline(p)}
            </p>
          ))}
        </div>
      )}

      {/* Download PDF */}
      <div style={{ width: "100%", maxWidth: 480, marginBottom: 10 }}>
        <button onClick={handleDownload} disabled={downloading} style={{
          width: "100%", padding: "14px 0",
          background: downloading ? "#AEB6BF" : "#1E8449",
          color: "white", border: "none", borderRadius: 10,
          fontWeight: "bold", fontSize: 14,
          cursor: downloading ? "not-allowed" : "pointer",
          boxShadow: "0 4px 12px rgba(30,132,73,0.35)",
        }}>
          {downloading ? "Creating PDF..." : "Download PDF Report"}
        </button>
      </div>

      {/* Buttons */}
      <div style={{ width: "100%", maxWidth: 480, display: "flex", gap: 10 }}>
        <button onClick={onEdit} style={{
          flex: 1, padding: "13px 0", background: "white",
          color: "#1A3C5E", border: "2px solid #1A3C5E",
          borderRadius: 10, fontWeight: "bold", fontSize: 13, cursor: "pointer",
        }}>
          ← Edit Details
        </button>
        <button onClick={onNewPlan} style={{
          flex: 1, padding: "13px 0", background: "#1A3C5E",
          color: "white", border: "none",
          borderRadius: 10, fontWeight: "bold", fontSize: 13, cursor: "pointer",
        }}>
          New Plan
        </button>
      </div>

      <div style={{
        fontSize: 10, color: "#AAA", textAlign: "center",
        marginTop: 14, lineHeight: 1.5, maxWidth: 480,
      }}>
        AI-generated concept plan only. A licensed architect
        must certify the final construction drawings.
      </div>
    </div>
  );
};

export default ResultsPage;